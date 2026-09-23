import type { Player } from '../types'

// ── Types ──────────────────────────────────────────────────────

export interface TeamDrawTeam {
    label: string
    color: string
    players: Player[]
    avg: number
}

export interface TeamDrawResult {
    teams: TeamDrawTeam[]
    suplentes: Player[]
    numTeams: number
    playersPerTeam: number
    drawDate: string
    scheduleName: string
    drawnAt: string   // ISO timestamp – used for "last drawn at X" display
}

export interface DrawValidationError {
    type: 'not_enough_goalkeepers' | 'not_enough_players' | 'not_enough_teams'
    message: string
}

// ── Helpers ────────────────────────────────────────────────────

const TEAM_LABELS = ['Time A', 'Time B', 'Time C', 'Time D', 'Time E', 'Time F']
const TEAM_COLORS = ['#16a34a', '#2563eb', '#7c3aed', '#d97706', '#dc2626', '#0891b2']

/** Sort by stars DESC; within same rating → Fisher-Yates shuffle for controlled randomness */
function shuffleSameRating(players: Player[]): Player[] {
    const sorted = [...players].sort((a, b) => b.stars - a.stars)
    const result: Player[] = []
    let i = 0
    while (i < sorted.length) {
        let j = i
        while (j < sorted.length && sorted[j].stars === sorted[i].stars) j++
        const group = sorted.slice(i, j)
        for (let k = group.length - 1; k > 0; k--) {
            const r = Math.floor(Math.random() * (k + 1))
            ;[group[k], group[r]] = [group[r], group[k]]
        }
        result.push(...group)
        i = j
    }
    return result
}

function teamAvg(players: Player[]): number {
    if (!players.length) return 0
    return Math.round((players.reduce((s, p) => s + p.stars, 0) / players.length) * 10) / 10
}

// ── Main algorithm ─────────────────────────────────────────────

/**
 * Rules:
 * 1. Each team gets EXACTLY `playersPerTeam` players (no over/under).
 * 2. Each team must have EXACTLY 1 goalkeeper.
 * 3. numTeams = min(floor(total / playersPerTeam), numGKs)
 *    → limited by whichever is lower: player count or GK count.
 * 4. Remaining players (beyond numTeams × playersPerTeam) → suplentes.
 * 5. Balance: greedy, always assign next outfield player to the non-full team with lowest current star sum.
 * 6. Randomness: players with the same star rating are shuffled before assignment.
 */
export function drawTeams(
    confirmed: Player[],
    playersPerTeam: number,
    scheduleName: string,
    drawDate: string,
): TeamDrawResult {
    const GKs = confirmed.filter(p => p.position === 'goleiro')
    const outfield = confirmed.filter(p => p.position === 'linha')

    // How many complete teams can we form?
    const teamsByPlayers = Math.floor(confirmed.length / playersPerTeam)
    const teamsByGKs = GKs.length   // 1 GK per team is mandatory
    const numTeams = Math.min(teamsByPlayers, teamsByGKs)

    // Validation
    if (GKs.length < 2) {
        throw {
            type: 'not_enough_goalkeepers',
            message: `Impossível sortear: cada time precisa de 1 goleiro. Você tem ${GKs.length} goleiro(s) confirmado(s) — é necessário ao menos 2.`,
        } as DrawValidationError
    }

    if (confirmed.length < playersPerTeam * 2) {
        throw {
            type: 'not_enough_players',
            message: `Impossível sortear: para montar 2 times de ${playersPerTeam} são necessários ${playersPerTeam * 2} confirmados. Você tem ${confirmed.length}.`,
        } as DrawValidationError
    }

    // At this point numTeams >= 2 is guaranteed

    // ── Assign GKs ──
    const sortedGKs = shuffleSameRating([...GKs])
    const teamGKs = sortedGKs.slice(0, numTeams)     // 1 per team
    const extraGKs = sortedGKs.slice(numTeams)        // extras join outfield pool

    // ── Outfield pool ──
    // Extra GKs play as outfield. Pool is sorted by stars (shuffled within ties).
    const outfieldPool = shuffleSameRating([...outfield, ...extraGKs])

    const outfieldPerTeam = playersPerTeam - 1        // spots per team minus the GK
    const totalOutfieldSlots = numTeams * outfieldPerTeam

    const inTeamOutfield = outfieldPool.slice(0, totalOutfieldSlots)
    const suplentes = outfieldPool.slice(totalOutfieldSlots)  // remainder → bench

    // ── Initialize teams with their GK ──
    const teams: { players: Player[]; sum: number }[] = teamGKs.map(gk => ({
        players: [gk],
        sum: gk.stars,
    }))

    // ── Greedy assignment: assign to non-full team with lowest star sum ──
    for (const player of inTeamOutfield) {
        const eligible = teams.filter(t => t.players.length < playersPerTeam)
        const target = eligible.reduce((best, t) => (t.sum < best.sum ? t : best))
        target.players.push(player)
        target.sum += player.stars
    }

    return {
        teams: teams.map((t, i) => ({
            label: TEAM_LABELS[i] ?? `Time ${i + 1}`,
            color: TEAM_COLORS[i] ?? '#6b7280',
            players: t.players,
            avg: teamAvg(t.players),
        })),
        suplentes,
        numTeams,
        playersPerTeam,
        drawDate,
        scheduleName,
        drawnAt: new Date().toISOString(),
    }
}

// ── localStorage persistence ───────────────────────────────────

const storageKey = (scheduleId: string, date: string) =>
    `pelada_draw_${scheduleId}_${date}`

export function saveDrawResult(scheduleId: string, date: string, result: TeamDrawResult): void {
    try { localStorage.setItem(storageKey(scheduleId, date), JSON.stringify(result)) }
    catch { /* quota exceeded – silently ignore */ }
}

export function loadDrawResult(scheduleId: string, date: string): TeamDrawResult | null {
    try {
        const raw = localStorage.getItem(storageKey(scheduleId, date))
        return raw ? JSON.parse(raw) : null
    } catch { return null }
}

export function clearDrawResult(scheduleId: string, date: string): void {
    localStorage.removeItem(storageKey(scheduleId, date))
}

// ── WhatsApp text formatter ────────────────────────────────────

const WA_EMOJIS = ['🟢', '🔵', '🟣', '🟠', '🔴', '🔵']

export function formatForWhatsApp(result: TeamDrawResult): string {
    const [y, m, d] = result.drawDate.split('-')
    const dateStr = `${d}/${m}/${y}`
    let text = `⚽ *TIMES SORTEADOS — ${result.scheduleName}*\n`
    text += `📅 *Data:* ${dateStr}\n`

    for (let i = 0; i < result.teams.length; i++) {
        const team = result.teams[i]
        const emoji = WA_EMOJIS[i] ?? '🔵'
        const gk = team.players.find(p => p.position === 'goleiro')
        const rest = team.players.filter(p => p !== gk)
        text += `\n${emoji} *${team.label}* (Média: ★ ${team.avg}) — ${team.players.length} jogadores\n`
        if (gk) text += `🧤 ${gk.name}${gk.nickname ? ` "${gk.nickname}"` : ''}\n`
        for (const p of rest) text += `• ${p.name}${p.nickname ? ` "${p.nickname}"` : ''}\n`
    }

    if (result.suplentes.length > 0) {
        text += `\n⏳ *SUPLENTES (${result.suplentes.length}):*\n`
        for (const p of result.suplentes) {
            text += `• ${p.name} ${p.position === 'goleiro' ? '🧤' : '⚽'}\n`
        }
    }

    text += `\n_Sorteado pelo Pelada Manager_ ⚽`
    return text
}
