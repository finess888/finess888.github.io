import { callGasApi } from "@/api/gasClient"

export type SleepQuality =
  | "ดีมาก (Deep)"
  | "ปกติ (Normal)"
  | "หลับไม่สนิท (Light)"
  | "เพลีย/นอนน้อย (Poor)"

export interface SleepLogEntry {
  id: string
  date: string // YYYY-MM-DD (วันที่ตื่น / วันที่บันทึก)
  person: "ฝ่ายชาย" | "ฝ่ายหญิง"
  bedTime: string // HH:mm เช่น "23:00"
  wakeTime: string // HH:mm เช่น "07:00"
  durationMinutes: number
  durationHours: number // เช่น 8.0
  quality: SleepQuality
  sleepGoalHours: number
  notes?: string
  createdAt: string
}

const STORAGE_SLEEP_LOGS_KEY = "finess_sleep_logs_v1"
const STORAGE_SLEEP_GOAL_MALE_KEY = "finess_sleep_goal_male"
const STORAGE_SLEEP_GOAL_FEMALE_KEY = "finess_sleep_goal_female"

export function calculateSleepDuration(bedTime: string, wakeTime: string): {
  hours: number
  minutes: number
  totalMinutes: number
  totalHoursDecimal: number
  formatted: string
  shortFormatted: string
} {
  if (!bedTime || !wakeTime || !bedTime.includes(":") || !wakeTime.includes(":")) {
    return {
      hours: 0,
      minutes: 0,
      totalMinutes: 0,
      totalHoursDecimal: 0,
      formatted: "0 ชม. 0 นาที",
      shortFormatted: "0 ชม.",
    }
  }

  const [bedH, bedM] = bedTime.split(":").map(Number)
  const [wakeH, wakeM] = wakeTime.split(":").map(Number)

  if (isNaN(bedH) || isNaN(bedM) || isNaN(wakeH) || isNaN(wakeM)) {
    return {
      hours: 0,
      minutes: 0,
      totalMinutes: 0,
      totalHoursDecimal: 0,
      formatted: "0 ชม. 0 นาที",
      shortFormatted: "0 ชม.",
    }
  }

  const bedTotalMins = bedH * 60 + bedM
  const wakeTotalMins = wakeH * 60 + wakeM

  // Handle overnight sleep (e.g., 23:00 to 07:00) vs same day (e.g., 01:00 to 08:30)
  let diffMins = wakeTotalMins - bedTotalMins
  if (diffMins <= 0) {
    diffMins += 24 * 60
  }

  const hours = Math.floor(diffMins / 60)
  const minutes = diffMins % 60
  const totalHoursDecimal = Number((diffMins / 60).toFixed(1))

  return {
    hours,
    minutes,
    totalMinutes: diffMins,
    totalHoursDecimal,
    formatted: minutes > 0 ? `${hours} ชม. ${minutes} นาที` : `${hours} ชม.`,
    shortFormatted: minutes > 0 ? `${hours}:${String(minutes).padStart(2, "0")} ชม.` : `${hours} ชม.`,
  }
}

/**
 * Checks if bedtime is considered "late night" (after 00:00 up to 05:00, or after 23:30)
 */
export function isLateBedtime(bedTime: string, cutoffHour = 23, cutoffMin = 30): boolean {
  if (!bedTime || !bedTime.includes(":")) return false
  const [h, m] = bedTime.split(":").map(Number)
  if (isNaN(h) || isNaN(m)) return false
  // Normalize evening/night hours onto a continuous timeline starting at 18:00 (1080 mins)
  const mins = h < 12 ? (h + 24) * 60 + m : h * 60 + m
  const cutoffMins = (cutoffHour < 12 ? cutoffHour + 24 : cutoffHour) * 60 + cutoffMin
  return mins > cutoffMins
}

/**
 * Computes average time (HH:mm) from an array of HH:mm strings using circular/overnight normalization
 */
export function calculateAverageClockTime(times: string[], isBedtime = false): string {
  const valid = times.filter((t) => t && t.includes(":"))
  if (valid.length === 0) return "--:--"

  let sumMins = 0
  let count = 0
  valid.forEach((t) => {
    const [h, m] = t.split(":").map(Number)
    if (!isNaN(h) && !isNaN(m)) {
      // For bedtime, hours 00:00 - 11:59 are treated as 24:00 - 35:59 so 23:00 and 01:00 average to 00:00
      const normalizedH = isBedtime && h < 12 ? h + 24 : h
      sumMins += normalizedH * 60 + m
      count++
    }
  })

  if (count === 0) return "--:--"
  let avgMins = Math.round(sumMins / count) % (24 * 60)
  if (avgMins < 0) avgMins += 24 * 60
  const hh = Math.floor(avgMins / 60)
  const mm = avgMins % 60
  return `${String(hh).padStart(2, "0")}:${String(mm).padStart(2, "0")}`
}

export function getSleepGoal(person: "ฝ่ายชาย" | "ฝ่ายหญิง"): number {
  try {
    const key = person === "ฝ่ายหญิง" ? STORAGE_SLEEP_GOAL_FEMALE_KEY : STORAGE_SLEEP_GOAL_MALE_KEY
    const raw = localStorage.getItem(key)
    if (raw) {
      const val = Number(raw)
      if (!isNaN(val) && val >= 4 && val <= 12) return val
    }
  } catch {}
  return 8
}

export function saveSleepGoal(person: "ฝ่ายชาย" | "ฝ่ายหญิง", hours: number): void {
  try {
    const key = person === "ฝ่ายหญิง" ? STORAGE_SLEEP_GOAL_FEMALE_KEY : STORAGE_SLEEP_GOAL_MALE_KEY
    localStorage.setItem(key, String(hours))
  } catch {}
}

export function getSleepLogs(): SleepLogEntry[] {
  try {
    const raw = localStorage.getItem(STORAGE_SLEEP_LOGS_KEY)
    if (raw) {
      const parsed = JSON.parse(raw)
      if (Array.isArray(parsed)) {
        return parsed
      }
    }
  } catch (err) {
    console.error("Error reading sleep logs:", err)
  }
  return []
}

export function saveSleepLog(entry: SleepLogEntry): void {
  try {
    const logs = getSleepLogs()
    const idx = logs.findIndex((l) => l.date === entry.date && l.person === entry.person)
    if (idx >= 0) {
      logs[idx] = entry
    } else {
      logs.unshift(entry)
    }
    // Sort by date descending
    logs.sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0))
    localStorage.setItem(STORAGE_SLEEP_LOGS_KEY, JSON.stringify(logs))
    callGasApi("SAVE_SLEEP_LOGS", logs).catch(() => {})
  } catch (err) {
    console.error("Error saving sleep log:", err)
  }
}

export function saveAllSleepLogs(logs: SleepLogEntry[]): void {
  try {
    localStorage.setItem(STORAGE_SLEEP_LOGS_KEY, JSON.stringify(logs))
  } catch (err) {
    console.error("Error saving all sleep logs:", err)
  }
}

export function deleteSleepLog(id: string): void {
  try {
    const logs = getSleepLogs().filter((l) => l.id !== id)
    localStorage.setItem(STORAGE_SLEEP_LOGS_KEY, JSON.stringify(logs))
    callGasApi("SAVE_SLEEP_LOGS", logs).catch(() => {})
  } catch (err) {
    console.error("Error deleting sleep log:", err)
  }
}

export function evaluateSleepStatus(
  durationHours: number,
  goalHours: number = 8,
  bedTime?: string,
  quality?: SleepQuality
): {
  status: "optimal" | "fair" | "short"
  label: string
  badgeClass: string
  energyScore: number
  energyLabel: string
  advice: string
} {
  // Base score from sleep duration (up to 65 points)
  const durationRatio = Math.min(1.1, durationHours / Math.max(1, goalHours))
  let score = Math.round(Math.min(65, durationRatio * 65))

  // Bedtime timing bonus (up to 20 points: sleeping before 23:00 gets 20, before 00:00 gets 14, after 00:00 gets 6)
  if (bedTime && bedTime.includes(":")) {
    if (!isLateBedtime(bedTime, 23, 0)) {
      score += 20
    } else if (!isLateBedtime(bedTime, 23, 59)) {
      score += 14
    } else {
      score += 6
    }
  } else {
    score += 14
  }

  // Quality bonus (up to 15 points)
  if (quality === "ดีมาก (Deep)") score += 15
  else if (quality === "ปกติ (Normal)") score += 12
  else if (quality === "หลับไม่สนิท (Light)") score += 7
  else if (quality === "เพลีย/นอนน้อย (Poor)") score += 3
  else score += 12

  score = Math.min(100, Math.max(0, score))

  const energyLabel =
    score >= 85
      ? "⚡ พลังงานเต็มเปี่ยมพร้อมเผาผลาญ"
      : score >= 70
      ? "🔋 พลังงานดีพร้อมใช้ชีวิต"
      : score >= 55
      ? "🌤️ พลังงานปานกลาง (ควรพักสายตา/ดื่มน้ำ)"
      : "🪫 พลังงานต่ำ (ระวังหิวของหวาน/คอร์ติซอลสูง)"

  if (durationHours >= goalHours) {
    const isLate = bedTime ? isLateBedtime(bedTime, 23, 45) : false
    return {
      status: "optimal",
      label: isLate ? "นอนครบชม. (แต่นอนดึก) 🌙" : "นอนเพียงพอ ✅",
      badgeClass: "bg-emerald-500/20 text-emerald-300 border-emerald-500/30",
      energyScore: score,
      energyLabel,
      advice: isLate
        ? "ชั่วโมงนอนครบเป้า แต่เข้านอนดึกหลังเที่ยงคืน ลองขยับเวลานอนเร็วขึ้นเพื่อรับ Growth Hormone ช่วง 22:00-02:00 น."
        : "ร่างกายฟื้นฟูเต็มที่ ฮอร์โมนอิ่ม (Leptin) ทำงานดีเยี่ยม ช่วยเผาผลาญไขมันและมีพลังงานสดชื่นตลอดวัน",
    }
  }
  if (durationHours >= 6) {
    return {
      status: "fair",
      label: "เกือบครบเป้า 🟡",
      badgeClass: "bg-amber-500/20 text-amber-300 border-amber-500/30",
      energyScore: score,
      energyLabel,
      advice: `ขาดอีก ${(goalHours - durationHours).toFixed(1)} ชม. แนะนำเข้านอนเร็วขึ้น 30-60 นาที เพื่อเพิ่มพลังงานและลดความอยากอาหารจุกจิก`,
    }
  }
  return {
    status: "short",
    label: "นอนน้อย ⚠️",
    badgeClass: "bg-rose-500/20 text-rose-300 border-rose-500/30",
    energyScore: score,
    energyLabel,
    advice: "นอนน้อยกว่า 6 ชม. เสี่ยงคอร์ติซอลสูงและหิวโหยง่าย (Ghrelin พุ่ง) วันนี้ควรเน้นโปรตีน ดื่มน้ำมากๆ และเลี่ยงของหวาน",
  }
}

export interface SleepRoutineSummary {
  totalLogs: number
  avgHours: number
  avgFormatted: string
  avgBedTime: string
  avgWakeTime: string
  goalMetDays: number
  goalMetPct: number
  goldenHourDays: number // เข้านอนไม่เกิน 23:30 น.
  goldenHourPct: number
  lateNightDays: number // เข้านอนหลัง 00:00 น.
  shortSleepDays: number // นอนน้อยกว่า 6 ชม.
  deepQualityDays: number // หลับสนิท / ปกติ
  avgEnergyScore: number
  routineAdvice: string
}

export function calculateSleepRoutineStats(
  logs: SleepLogEntry[],
  options?: {
    person?: string
    startDate?: string
    endDate?: string
  }
): SleepRoutineSummary {
  const filtered = logs.filter((l) => {
    if (options?.person && options.person !== "ALL" && l.person !== options.person) return false
    if (options?.startDate && l.date < options.startDate) return false
    if (options?.endDate && l.date > options.endDate) return false
    return true
  })

  if (filtered.length === 0) {
    return {
      totalLogs: 0,
      avgHours: 0,
      avgFormatted: "0 ชม.",
      avgBedTime: "--:--",
      avgWakeTime: "--:--",
      goalMetDays: 0,
      goalMetPct: 0,
      goldenHourDays: 0,
      goldenHourPct: 0,
      lateNightDays: 0,
      shortSleepDays: 0,
      deepQualityDays: 0,
      avgEnergyScore: 0,
      routineAdvice: "เริ่มบันทึกเวลานอนและเวลาตื่น เพื่อให้ระบบวิเคราะห์รูทีนการลดน้ำหนักและระดับพลังงานรายวัน",
    }
  }

  const totalMins = filtered.reduce((s, l) => s + (Number(l.durationMinutes) || 0), 0)
  const avgMins = Math.round(totalMins / filtered.length)
  const avgH = Math.floor(avgMins / 60)
  const avgM = avgMins % 60
  const avgHours = Number((avgMins / 60).toFixed(1))

  const avgBedTime = calculateAverageClockTime(
    filtered.map((l) => l.bedTime),
    true
  )
  const avgWakeTime = calculateAverageClockTime(
    filtered.map((l) => l.wakeTime),
    false
  )

  let goalMetDays = 0
  let goldenHourDays = 0
  let lateNightDays = 0
  let shortSleepDays = 0
  let deepQualityDays = 0
  let sumEnergy = 0

  filtered.forEach((l) => {
    const goal = l.sleepGoalHours || 7.5
    if (l.durationHours >= goal) goalMetDays++
    if (l.durationHours < 6) shortSleepDays++
    if (!isLateBedtime(l.bedTime, 23, 30)) goldenHourDays++
    if (isLateBedtime(l.bedTime, 23, 59)) lateNightDays++
    if (l.quality === "ดีมาก (Deep)" || l.quality === "ปกติ (Normal)") deepQualityDays++

    const ev = evaluateSleepStatus(l.durationHours, goal, l.bedTime, l.quality)
    sumEnergy += ev.energyScore
  })

  const goalMetPct = Math.round((goalMetDays / filtered.length) * 100)
  const goldenHourPct = Math.round((goldenHourDays / filtered.length) * 100)
  const avgEnergyScore = Math.round(sumEnergy / filtered.length)

  let routineAdvice = ""
  if (avgHours >= 7.5 && goldenHourPct >= 70) {
    routineAdvice = `🌟 รูทีนการนอนยอดเยี่ยมมาก! เข้านอนเฉลี่ย ${avgBedTime} น. และนอนเฉลี่ย ${avgHours} ชม. ช่วยให้ฮอร์โมนเผาผลาญไขมันทำงานเต็มประสิทธิภาพและมีพลังงานสดชื่นตลอดวัน`
  } else if (lateNightDays > filtered.length / 2) {
    routineAdvice = `🌙 พบว่าเข้านอนดึกหลังเที่ยงคืน ${lateNightDays} คืน (ค่าเฉลี่ย ${avgBedTime} น.) แม้บางวันจะตื่นสายชดเชยได้ แต่การนอนดึกจะเพิ่มคอร์ติซอลและทำให้เพลียระหว่างวัน แนะนำขยับเวลาเข้านอนให้เร็วขึ้นครั้งละ 30 นาที`
  } else if (avgHours < 7) {
    routineAdvice = `⚠️ ชั่วโมงการนอนเฉลี่ยยังอยู่ที่ ${avgHours} ชม./คืน (ต่ำกว่า 7.5 ชม.) เสี่ยงต่ออาการหิวโหยระหว่างวันและระบบเผาผลาญชะลอตัว แนะนำล็อกเวลาเข้านอนก่อน 23:00 น.`
  } else {
    routineAdvice = `💡 รูทีนการนอนอยู่ในเกณฑ์ดี (เฉลี่ย ${avgHours} ชม. • เข้านอน ${avgBedTime} น. • ตื่น ${avgWakeTime} น.) รักษาเวลาตื่นให้ตรงกันทุกวันเพื่อล็อกนาฬิกาชีวิต (Circadian Rhythm)`
  }

  return {
    totalLogs: filtered.length,
    avgHours,
    avgFormatted: avgM > 0 ? `${avgH} ชม. ${avgM} นาที` : `${avgH} ชม.`,
    avgBedTime,
    avgWakeTime,
    goalMetDays,
    goalMetPct,
    goldenHourDays,
    goldenHourPct,
    lateNightDays,
    shortSleepDays,
    deepQualityDays,
    avgEnergyScore,
    routineAdvice,
  }
}
