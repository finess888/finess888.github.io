import * as React from "react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog"
import {
  CalendarCheck,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  ChevronLeft,
  ChevronRight,
  Flame,
  Footprints,
  Scale,
  Utensils,
  Plus,
  Trophy,
  Sparkles,
  Info,
  Clock,
  TrendingUp,
  Percent,
  Calendar,
  Beef,
  Wheat,
  Droplet,
  Users,
  Heart,
  Moon,
} from "lucide-react"
import { formatThaiDate, THAI_MONTHS, THAI_DAYS } from "@/lib/utils"
import { getCalorieSettings, getIntakeTarget } from "@/lib/calorieSettings"
import { getDailyStepLogs, DailyStepLog } from "@/lib/exerciseDatabase"
import { getSleepLogs, SleepLogEntry, calculateSleepDuration } from "@/lib/sleepTracker"

interface CalendarViewProps {
  meals: any[]
  foods: any[]
  healthLogs: any[]
  selectedPerson?: string
  onSelectPerson?: (person: string) => void
  onOpenAddMeal?: (date?: string, person?: string) => void
  onOpenAddStep?: (date?: string) => void
  onOpenAddWeight?: (date?: string) => void
  onOpenAddSleep?: (date?: string, person?: string) => void
}

type CriteriaType = "calories" | "steps" | "protein" | "sleep" | "all"

interface PersonDayStats {
  meals: any[]
  totalCalories: number
  totalProtein: number
  totalCarbs: number
  totalFat: number
  targetCalories: number
  maintenanceCalories: number
  targetSteps: number
  targetProtein: number
  stepCount: number
  weight: number | null
  sleepLog: SleepLogEntry | null
  calorieDiff: number // target - actual
  maintenanceDiff: number // maintenance - actual
  status: "good" | "maintain" | "bad" | "unrecorded" | "future"
  statusLabel: string
  statusReason: string
}

interface DayData {
  dateStr: string
  dayNum: number
  isToday: boolean
  isFuture: boolean
  dayOfWeek: number
  male: PersonDayStats
  female: PersonDayStats
  coupleStatus: "both_good" | "male_only" | "female_only" | "both_bad" | "partial_unrecorded" | "unrecorded" | "future"
  coupleStatusLabel: string
  coupleStatusShortLabel: string
  coupleStatusBadgeColor: string
  // Active filtered view helpers
  activeStatus: "good" | "maintain" | "bad" | "unrecorded" | "future"
  activeLabel: string
  activeCalories: number
  activeTargetCalories: number
  activeMaintenanceCalories: number
  activeCalorieDiff: number
  activeMaintenanceDiff: number
  activeMealsCount: number
  activeStepCount: number
  activeProtein: number
  activeWeight: number | null
}

export function CalendarView({
  meals,
  foods,
  healthLogs,
  selectedPerson = "ALL",
  onSelectPerson,
  onOpenAddMeal,
  onOpenAddStep,
  onOpenAddWeight,
  onOpenAddSleep,
}: CalendarViewProps) {
  const today = new Date()
  const todayStr = today.toLocaleDateString("en-CA") // YYYY-MM-DD in local time

  // Month & Year state (defaults to current month and year)
  const [selectedYear, setSelectedYear] = React.useState<number>(today.getFullYear())
  const [selectedMonth, setSelectedMonth] = React.useState<number>(today.getMonth()) // 0 - 11

  // Person filter - Default to "ALL" (รวมชายหญิง)
  const [personFilter, setPersonFilter] = React.useState<string>(selectedPerson || "ALL")

  React.useEffect(() => {
    if (selectedPerson) {
      setPersonFilter(selectedPerson)
    }
  }, [selectedPerson])

  // Evaluation criteria
  const [criteria, setCriteria] = React.useState<CriteriaType>("calories")

  // Selected day for modal details
  const [selectedDay, setSelectedDay] = React.useState<DayData | null>(null)
  const [dayModalOpen, setDayModalOpen] = React.useState(false)
  const [detailTab, setDetailTab] = React.useState<"male" | "female" | "both">("both")

  // Calorie & Target settings
  const calorieSettings = getCalorieSettings()
  const maleSettings = calorieSettings.male
  const femaleSettings = calorieSettings.female

  const maleTargetIntake = getIntakeTarget(maleSettings) // e.g. 2000 - 300 = 1700
  const femaleTargetIntake = getIntakeTarget(femaleSettings) // e.g. 1700 - 300 = 1400

  const maleStepTarget = maleSettings.stepGoal || 8000
  const femaleStepTarget = femaleSettings.stepGoal || 8000

  const maleProteinTarget = maleSettings.protein || 120
  const femaleProteinTarget = femaleSettings.protein || 104

  const isFemale = personFilter === "ฝ่ายหญิง"
  const isMale = personFilter === "ฝ่ายชาย"
  const isAll = personFilter === "ALL"

  // Month navigation handlers
  const handlePrevMonth = () => {
    if (selectedMonth === 0) {
      setSelectedMonth(11)
      setSelectedYear((y) => y - 1)
    } else {
      setSelectedMonth((m) => m - 1)
    }
  }

  const handleNextMonth = () => {
    if (selectedMonth === 11) {
      setSelectedMonth(0)
      setSelectedYear((y) => y + 1)
    } else {
      setSelectedMonth((m) => m + 1)
    }
  }

  const handleJumpToToday = () => {
    setSelectedYear(today.getFullYear())
    setSelectedMonth(today.getMonth())
  }

  // Evaluate person day
  const evaluatePersonDay = (
    personMeals: any[],
    stepCount: number,
    sleepLog: SleepLogEntry | null,
    targetCal: number,
    maintenanceCal: number,
    targetStep: number,
    targetProt: number,
    isFuture: boolean
  ): { status: "good" | "maintain" | "bad" | "unrecorded" | "future"; statusLabel: string; statusReason: string } => {
    const totalCal = personMeals.reduce((s, m) => s + (Number(m.calories || m.Calories) || 0), 0)
    const totalProt = personMeals.reduce((s, m) => s + (Number(m.protein || m.Protein) || 0), 0)
    const diff = targetCal - totalCal
    const maintenanceDiff = maintenanceCal - totalCal
    const overMaintenance = maintenanceCal > targetCal ? Math.abs(maintenanceDiff) : Math.abs(diff)
    const hasMeals = personMeals.length > 0
    const hasSteps = stepCount > 0
    const hasSleep = !!sleepLog

    if (isFuture) {
      return { status: "future", statusLabel: "รอสรุป", statusReason: "ยังไม่ถึงวัน" }
    }

    if (criteria === "calories") {
      if (!hasMeals) {
        return { status: "unrecorded", statusLabel: "ยังไม่จด", statusReason: "ยังไม่มีบันทึกมื้ออาหาร" }
      }
      if (totalCal <= targetCal) {
        return { status: "good", statusLabel: "คุมดี ✅", statusReason: `อยู่ในโควต้า (เหลือ ${diff.toLocaleString()} kcal)` }
      }
      if (maintenanceCal > targetCal && totalCal <= maintenanceCal) {
        return { status: "maintain", statusLabel: "ประคอง 🟡", statusReason: `เกินเป้าตัด +${Math.abs(diff).toLocaleString()} kcal (ไม่เกินเมนเทน ${maintenanceCal.toLocaleString()})` }
      }
      return { status: "bad", statusLabel: "เกินเป้า ❌", statusReason: `กินเกินเมนเทน +${overMaintenance.toLocaleString()} kcal` }
    }

    if (criteria === "steps") {
      if (!hasSteps) {
        return { status: "unrecorded", statusLabel: "ยังไม่จด", statusReason: "ยังไม่มีบันทึกก้าว" }
      }
      if (stepCount >= targetStep) {
        return { status: "good", statusLabel: "ครบก้าว ✅", statusReason: `เดินได้ ${stepCount.toLocaleString()} / เป้า ${targetStep.toLocaleString()} ก้าว` }
      }
      if (stepCount >= targetStep * 0.75) {
        return { status: "maintain", statusLabel: "เกือบครบ 🟡", statusReason: `เดินได้ ${stepCount.toLocaleString()} ก้าว (ขาด ${(targetStep - stepCount).toLocaleString()})` }
      }
      return { status: "bad", statusLabel: "ขาดก้าว ❌", statusReason: `ขาดอีก ${(targetStep - stepCount).toLocaleString()} ก้าว` }
    }

    if (criteria === "protein") {
      if (!hasMeals) {
        return { status: "unrecorded", statusLabel: "ยังไม่จด", statusReason: "ยังไม่มีบันทึกอาหาร" }
      }
      if (totalProt >= targetProt) {
        return { status: "good", statusLabel: "โปรตีนถึง ✅", statusReason: `ได้โปรตีน ${totalProt.toFixed(1)}g / เป้า ${targetProt}g` }
      }
      if (totalProt >= targetProt * 0.8) {
        return { status: "maintain", statusLabel: "เกือบถึง 🟡", statusReason: `ได้โปรตีน ${totalProt.toFixed(1)}g (ขาด ${(targetProt - totalProt).toFixed(1)}g)` }
      }
      return { status: "bad", statusLabel: "ขาดโปรตีน ❌", statusReason: `ขาดอีก ${(targetProt - totalProt).toFixed(1)}g` }
    }

    if (criteria === "sleep") {
      if (!hasSleep || !sleepLog) {
        return { status: "unrecorded", statusLabel: "ยังไม่จด", statusReason: "ยังไม่มีบันทึกเวลานอน" }
      }
      const sleepGoal = sleepLog.sleepGoalHours || 7.5
      if (sleepLog.durationHours >= sleepGoal) {
        return {
          status: "good",
          statusLabel: "นอนพอ ✅",
          statusReason: `นอน ${sleepLog.durationHours} ชม. (${sleepLog.bedTime}-${sleepLog.wakeTime})`,
        }
      }
      if (sleepLog.durationHours >= 6) {
        return {
          status: "maintain",
          statusLabel: "ปานกลาง 🟡",
          statusReason: `นอน ${sleepLog.durationHours} ชม. (เป้า ${sleepGoal} ชม.)`,
        }
      }
      return {
        status: "bad",
        statusLabel: "นอนน้อย ❌",
        statusReason: `นอนเพียง ${sleepLog.durationHours} ชม. (< 6 ชม.)`,
      }
    }

    // Criteria: "all" (ครบสูตรรูทีน: โภชนาการ + โปรตีน/ก้าวเดิน + การนอน)
    if (!hasMeals && !hasSteps && !hasSleep) {
      return { status: "unrecorded", statusLabel: "ยังไม่จด", statusReason: "ยังไม่มีบันทึกรูทีน" }
    }
    if (!hasMeals) {
      return { status: "unrecorded", statusLabel: "รอจดอาหาร", statusReason: "ยังไม่มีบันทึกอาหาร" }
    }
    const sleepOk = !sleepLog || sleepLog.durationHours >= 6.5
    if (totalCal <= targetCal) {
      if ((stepCount >= targetStep || totalProt >= targetProt) && sleepOk) {
        return { status: "good", statusLabel: "รูทีนดีเยี่ยม 🌟", statusReason: "คุมแคลอรี่ดี + กิจกรรม/โปรตีน/การนอนสมดุล" }
      }
      return { status: "good", statusLabel: "คุมดี ✅", statusReason: "แคลอรี่อยู่ในโควต้าลดไขมัน" }
    }
    if (maintenanceCal > targetCal && totalCal <= maintenanceCal) {
      return { status: "maintain", statusLabel: "ประคอง 🟡", statusReason: `เกินเป้าตัด +${Math.abs(diff).toLocaleString()} kcal (ไม่เกินเมนเทน ${maintenanceCal.toLocaleString()})` }
    }
    return { status: "bad", statusLabel: "เกินเป้า ❌", statusReason: `กินเกินเมนเทน +${overMaintenance.toLocaleString()} kcal` }
  }

  // Generate days in the selected month
  const monthDays: DayData[] = React.useMemo(() => {
    const daysInMonth = new Date(selectedYear, selectedMonth + 1, 0).getDate()
    const allStepLogs = getDailyStepLogs()
    const allSleepLogs = getSleepLogs()

    const result: DayData[] = []

    for (let day = 1; day <= daysInMonth; day++) {
      const dateStr = `${selectedYear}-${String(selectedMonth + 1).padStart(2, "0")}-${String(
        day
      ).padStart(2, "0")}`

      const dayDate = new Date(selectedYear, selectedMonth, day)
      const dayOfWeek = dayDate.getDay()
      const isToday = dateStr === todayStr
      const isFuture = dateStr > todayStr

      // Male data
      const maleMeals = meals.filter((m) => {
        const mDate = String(m.date || m.Date || "").split("T")[0]
        const mPerson = String(m.person || m.Person || "").trim()
        return mDate === dateStr && (mPerson === "ฝ่ายชาย" || mPerson === "ทั้งคู่")
      })
      const maleSteps = allStepLogs
        .filter((s) => s.date === dateStr && s.person === "ฝ่ายชาย")
        .reduce((sum, s) => sum + (Number(s.steps) || 0), 0)

      const maleCals = maleMeals.reduce((s, m) => s + (Number(m.calories || m.Calories) || 0), 0)
      const maleProt = Number(maleMeals.reduce((s, m) => s + (Number(m.protein || m.Protein) || 0), 0).toFixed(1))
      const maleCarb = Number(maleMeals.reduce((s, m) => s + (Number(m.carbs || m.Carbs) || 0), 0).toFixed(1))
      const maleFat = Number(maleMeals.reduce((s, m) => s + (Number(m.fat || m.Fat) || 0), 0).toFixed(1))

      const dayHealth = healthLogs.find((h) => String(h.date || h.Date || "").split("T")[0] === dateStr)
      const maleWeight = dayHealth?.maleWeight || null
      const femaleWeight = dayHealth?.femaleWeight || null
      const maleSleep = allSleepLogs.find((s) => s.date === dateStr && s.person === "ฝ่ายชาย") || null
      const femaleSleep = allSleepLogs.find((s) => s.date === dateStr && s.person === "ฝ่ายหญิง") || null

      const maleEval = evaluatePersonDay(
        maleMeals,
        maleSteps,
        maleSleep,
        maleTargetIntake,
        maleSettings.maintenance || maleTargetIntake,
        maleStepTarget,
        maleProteinTarget,
        isFuture
      )

      const maleMaintenanceCal = maleSettings.maintenance || maleTargetIntake
      const maleStats: PersonDayStats = {
        meals: maleMeals,
        totalCalories: maleCals,
        totalProtein: maleProt,
        totalCarbs: maleCarb,
        totalFat: maleFat,
        targetCalories: maleTargetIntake,
        maintenanceCalories: maleMaintenanceCal,
        targetSteps: maleStepTarget,
        targetProtein: maleProteinTarget,
        stepCount: maleSteps,
        weight: maleWeight,
        sleepLog: maleSleep,
        calorieDiff: maleTargetIntake - maleCals,
        maintenanceDiff: maleMaintenanceCal - maleCals,
        status: maleEval.status,
        statusLabel: maleEval.statusLabel,
        statusReason: maleEval.statusReason,
      }

      // Female data
      const femaleMeals = meals.filter((m) => {
        const mDate = String(m.date || m.Date || "").split("T")[0]
        const mPerson = String(m.person || m.Person || "").trim()
        return mDate === dateStr && (mPerson === "ฝ่ายหญิง" || mPerson === "ทั้งคู่")
      })
      const femaleSteps = allStepLogs
        .filter((s) => s.date === dateStr && s.person === "ฝ่ายหญิง")
        .reduce((sum, s) => sum + (Number(s.steps) || 0), 0)

      const femaleCals = femaleMeals.reduce((s, m) => s + (Number(m.calories || m.Calories) || 0), 0)
      const femaleProt = Number(femaleMeals.reduce((s, m) => s + (Number(m.protein || m.Protein) || 0), 0).toFixed(1))
      const femaleCarb = Number(femaleMeals.reduce((s, m) => s + (Number(m.carbs || m.Carbs) || 0), 0).toFixed(1))
      const femaleFat = Number(femaleMeals.reduce((s, m) => s + (Number(m.fat || m.Fat) || 0), 0).toFixed(1))

      const femaleEval = evaluatePersonDay(
        femaleMeals,
        femaleSteps,
        femaleSleep,
        femaleTargetIntake,
        femaleSettings.maintenance || femaleTargetIntake,
        femaleStepTarget,
        femaleProteinTarget,
        isFuture
      )

      const femaleMaintenanceCal = femaleSettings.maintenance || femaleTargetIntake
      const femaleStats: PersonDayStats = {
        meals: femaleMeals,
        totalCalories: femaleCals,
        totalProtein: femaleProt,
        totalCarbs: femaleCarb,
        totalFat: femaleFat,
        targetCalories: femaleTargetIntake,
        maintenanceCalories: femaleMaintenanceCal,
        targetSteps: femaleStepTarget,
        targetProtein: femaleProteinTarget,
        stepCount: femaleSteps,
        weight: femaleWeight,
        sleepLog: femaleSleep,
        calorieDiff: femaleTargetIntake - femaleCals,
        maintenanceDiff: femaleMaintenanceCal - femaleCals,
        status: femaleEval.status,
        statusLabel: femaleEval.statusLabel,
        statusReason: femaleEval.statusReason,
      }

      // Couple evaluation (รวมชายหญิง)
      let coupleStatus: DayData["coupleStatus"] = "unrecorded"
      let coupleStatusLabel = "ยังไม่บันทึก"
      let coupleStatusShortLabel = "--"
      let coupleStatusBadgeColor = "bg-slate-700 text-slate-300"

      if (isFuture) {
        coupleStatus = "future"
        coupleStatusLabel = "รอสรุป"
        coupleStatusShortLabel = "รอ"
        coupleStatusBadgeColor = "bg-slate-800/60 text-slate-500"
      } else if (maleStats.status === "good" && femaleStats.status === "good") {
        coupleStatus = "both_good"
        coupleStatusLabel = "🌟 ดีทั้งคู่ ✅"
        coupleStatusShortLabel = "🌟 ดีคู่"
        coupleStatusBadgeColor = "bg-gradient-to-r from-emerald-500 to-teal-400 text-slate-950 font-extrabold"
      } else if (maleStats.status === "good" && femaleStats.status === "bad") {
        coupleStatus = "male_only"
        coupleStatusLabel = "🏋️‍♂️ ชายดี (หญิงเกิน)"
        coupleStatusShortLabel = "🏋️ ดี"
        coupleStatusBadgeColor = "bg-amber-600 text-white"
      } else if (femaleStats.status === "good" && maleStats.status === "bad") {
        coupleStatus = "female_only"
        coupleStatusLabel = "🧘‍♀️ หญิงดี (ชายเกิน)"
        coupleStatusShortLabel = "🧘‍♀️ ดี"
        coupleStatusBadgeColor = "bg-pink-600 text-white"
      } else if (maleStats.status === "bad" && femaleStats.status === "bad") {
        coupleStatus = "both_bad"
        coupleStatusLabel = "❌ หลุดคู่"
        coupleStatusShortLabel = "❌ หลุด"
        coupleStatusBadgeColor = "bg-rose-600 text-white"
      } else if (maleStats.status === "good" || femaleStats.status === "good") {
        coupleStatus = maleStats.status === "good" ? "male_only" : "female_only"
        coupleStatusLabel = maleStats.status === "good" ? "🏋️‍♂️ ชายดี" : "🧘‍♀️ หญิงดี"
        coupleStatusShortLabel = maleStats.status === "good" ? "🏋️ ดี" : "🧘‍♀️ ดี"
        coupleStatusBadgeColor = maleStats.status === "good" ? "bg-emerald-600 text-white" : "bg-pink-600 text-white"
      } else if (maleStats.status === "bad" || femaleStats.status === "bad") {
        coupleStatus = "both_bad"
        coupleStatusLabel = maleStats.status === "bad" ? "⚠️ ชายเกิน" : "⚠️ หญิงเกิน"
        coupleStatusShortLabel = maleStats.status === "bad" ? "⚠️ ชายเกิน" : "⚠️ หญิงเกิน"
        coupleStatusBadgeColor = "bg-rose-600 text-white"
      } else {
        coupleStatus = "unrecorded"
        coupleStatusLabel = "--"
        coupleStatusShortLabel = "--"
        coupleStatusBadgeColor = "bg-slate-800 text-slate-500"
      }

      // Active stats depending on current view filter
      let activeStatus: DayData["activeStatus"] = "unrecorded"
      let activeLabel = ""
      let activeCalories = 0
      let activeTargetCalories = 0
      let activeMaintenanceCalories = 0
      let activeCalorieDiff = 0
      let activeMaintenanceDiff = 0
      let activeMealsCount = 0
      let activeStepCount = 0
      let activeProtein = 0
      let activeWeight: number | null = null

      if (personFilter === "ฝ่ายชาย") {
        activeStatus = maleStats.status
        activeLabel = maleStats.statusLabel
        activeCalories = maleStats.totalCalories
        activeTargetCalories = maleStats.targetCalories
        activeMaintenanceCalories = maleStats.maintenanceCalories
        activeCalorieDiff = maleStats.calorieDiff
        activeMaintenanceDiff = maleStats.maintenanceDiff
        activeMealsCount = maleStats.meals.length
        activeStepCount = maleStats.stepCount
        activeProtein = maleStats.totalProtein
        activeWeight = maleStats.weight
      } else if (personFilter === "ฝ่ายหญิง") {
        activeStatus = femaleStats.status
        activeLabel = femaleStats.statusLabel
        activeCalories = femaleStats.totalCalories
        activeTargetCalories = femaleStats.targetCalories
        activeMaintenanceCalories = femaleStats.maintenanceCalories
        activeCalorieDiff = femaleStats.calorieDiff
        activeMaintenanceDiff = femaleStats.maintenanceDiff
        activeMealsCount = femaleStats.meals.length
        activeStepCount = femaleStats.stepCount
        activeProtein = femaleStats.totalProtein
        activeWeight = femaleStats.weight
      } else {
        // "ALL" (รวมชายหญิง)
        activeStatus =
          coupleStatus === "both_good"
            ? "good"
            : coupleStatus === "both_bad"
            ? "bad"
            : coupleStatus === "male_only" || coupleStatus === "female_only"
            ? "good"
            : coupleStatus === "future"
            ? "future"
            : "unrecorded"
        activeLabel = coupleStatusLabel
        activeCalories = maleStats.totalCalories + femaleStats.totalCalories
        activeTargetCalories = maleStats.targetCalories + femaleStats.targetCalories
        activeMaintenanceCalories = maleStats.maintenanceCalories + femaleStats.maintenanceCalories
        activeCalorieDiff = activeTargetCalories - activeCalories
        activeMaintenanceDiff = activeMaintenanceCalories - activeCalories
        activeMealsCount = maleStats.meals.length + femaleStats.meals.length
        activeStepCount = maleStats.stepCount + femaleStats.stepCount
        activeProtein = Number((maleStats.totalProtein + femaleStats.totalProtein).toFixed(1))
        activeWeight = (maleWeight || 0) + (femaleWeight || 0) || null
      }

      result.push({
        dateStr,
        dayNum: day,
        isToday,
        isFuture,
        dayOfWeek,
        male: maleStats,
        female: femaleStats,
        coupleStatus,
        coupleStatusLabel,
        coupleStatusShortLabel,
        coupleStatusBadgeColor,
        activeStatus,
        activeLabel,
        activeCalories,
        activeTargetCalories,
        activeMaintenanceCalories,
        activeCalorieDiff,
        activeMaintenanceDiff,
        activeMealsCount,
        activeStepCount,
        activeProtein,
        activeWeight,
      })
    }

    return result
  }, [
    selectedYear,
    selectedMonth,
    todayStr,
    meals,
    healthLogs,
    maleTargetIntake,
    femaleTargetIntake,
    maleSettings.maintenance,
    femaleSettings.maintenance,
    maleStepTarget,
    femaleStepTarget,
    maleProteinTarget,
    femaleProteinTarget,
    criteria,
    personFilter,
  ])

  // Leading empty slots for calendar alignment (Sun=0, Mon=1...)
  const firstDayOffset = React.useMemo(() => {
    return new Date(selectedYear, selectedMonth, 1).getDay()
  }, [selectedYear, selectedMonth])

  // Monthly summary calculations (รองรับทั้ง รวมชายหญิง และแยกคน)
  const monthlyStats = React.useMemo(() => {
    let bothGoodDays = 0
    let maleGoodDays = 0
    let maleBadDays = 0
    let femaleGoodDays = 0
    let femaleBadDays = 0
    let loggedDaysCount = 0
    let futureDaysCount = 0

    let maleLongestStreak = 0
    let maleStreakCounter = 0
    let femaleLongestStreak = 0
    let femaleStreakCounter = 0
    let coupleLongestStreak = 0
    let coupleStreakCounter = 0

    monthDays.forEach((d) => {
      if (d.isFuture) {
        futureDaysCount++
        return
      }

      const hasMaleLog = d.male.status !== "unrecorded"
      const hasFemaleLog = d.female.status !== "unrecorded"

      if (hasMaleLog || hasFemaleLog) {
        loggedDaysCount++
      }

      if (d.coupleStatus === "both_good") {
        bothGoodDays++
        coupleStreakCounter++
        if (coupleStreakCounter > coupleLongestStreak) coupleLongestStreak = coupleStreakCounter
      } else {
        coupleStreakCounter = 0
      }

      if (d.male.status === "good") {
        maleGoodDays++
        maleStreakCounter++
        if (maleStreakCounter > maleLongestStreak) maleLongestStreak = maleStreakCounter
      } else if (d.male.status === "bad") {
        maleBadDays++
        maleStreakCounter = 0
      }

      if (d.female.status === "good") {
        femaleGoodDays++
        femaleStreakCounter++
        if (femaleStreakCounter > femaleLongestStreak) femaleLongestStreak = femaleStreakCounter
      } else if (d.female.status === "bad") {
        femaleBadDays++
        femaleStreakCounter = 0
      }
    })

    const maleTotalLogged = maleGoodDays + maleBadDays
    const femaleTotalLogged = femaleGoodDays + femaleBadDays

    const maleAdherence = maleTotalLogged > 0 ? Math.round((maleGoodDays / maleTotalLogged) * 100) : 0
    const femaleAdherence = femaleTotalLogged > 0 ? Math.round((femaleGoodDays / femaleTotalLogged) * 100) : 0

    return {
      bothGoodDays,
      maleGoodDays,
      maleBadDays,
      femaleGoodDays,
      femaleBadDays,
      loggedDaysCount,
      futureDaysCount,
      maleAdherence,
      femaleAdherence,
      maleLongestStreak,
      femaleLongestStreak,
      coupleLongestStreak,
    }
  }, [monthDays])

  const openDayDetails = (day: DayData) => {
    setSelectedDay(day)
    setDetailTab(personFilter === "ฝ่ายหญิง" ? "female" : personFilter === "ฝ่ายชาย" ? "male" : "both")
    setDayModalOpen(true)
  }

  return (
    <div className="space-y-6">
      {/* Top Banner & Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-gradient-to-r from-slate-900 via-[#151d2f] to-[#151d2f] border border-[#26334d] rounded-2xl p-6 shadow-lg">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-2xl">📅</span>
            <h1 className="text-2xl font-bold text-white tracking-tight flex items-center gap-2 flex-wrap">
              ปฏิทินความสำเร็จรายเดือน
              <span className="text-xs font-semibold text-emerald-300 bg-emerald-500/20 px-2.5 py-0.5 rounded-full border border-emerald-500/30 flex items-center gap-1">
                <Heart className="h-3 w-3 text-pink-400 fill-pink-400" />
                รวมชายหญิง (คู่รัก)
              </span>
            </h1>
          </div>
          <p className="text-xs text-slate-400">
            ดูภาพรวมรายเดือนคู่รัก ติ๊กถูกวันคุมดี ✅ เช็กวันหลุดเป้า ❌ พร้อมสรุปความสำเร็จของทั้งสองคน
          </p>
        </div>

        {/* Person Selector Tabs */}
        <div className="flex items-center gap-1 bg-[#0b0f19] p-1.5 rounded-xl border border-[#26334d]">
          <button
            onClick={() => {
              setPersonFilter("ALL")
              if (onSelectPerson) onSelectPerson("ALL")
            }}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all ${
              personFilter === "ALL"
                ? "bg-gradient-to-r from-indigo-600 to-emerald-600 text-white shadow-md shadow-indigo-950 font-bold"
                : "text-slate-400 hover:text-white"
            }`}
          >
            <Users className="h-3.5 w-3.5 text-indigo-300" />
            <span>รวมชายหญิง (แนะนำ)</span>
          </button>
          <button
            onClick={() => {
              setPersonFilter("ฝ่ายชาย")
              if (onSelectPerson) onSelectPerson("ฝ่ายชาย")
            }}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all ${
              personFilter === "ฝ่ายชาย"
                ? "bg-emerald-600 text-white shadow-md shadow-emerald-950 font-bold"
                : "text-slate-400 hover:text-white"
            }`}
          >
            <span>🏋️‍♂️</span> ชาย
          </button>
          <button
            onClick={() => {
              setPersonFilter("ฝ่ายหญิง")
              if (onSelectPerson) onSelectPerson("ฝ่ายหญิง")
            }}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all ${
              personFilter === "ฝ่ายหญิง"
                ? "bg-pink-600 text-white shadow-md shadow-pink-950 font-bold"
                : "text-slate-400 hover:text-white"
            }`}
          >
            <span>🧘‍♀️</span> หญิง
          </button>
        </div>
      </div>

      {/* 4 Scorecard Summary Cards (รวมชายหญิง: สรุปดีกี่วันร้ายกี่วันแบบคู่รัก) */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        {/* Card 1: วันคุมดีทั้งคู่ */}
        <Card className="bg-gradient-to-br from-[#0c1f1c] via-[#102924] to-[#142e2b] border border-emerald-500/50 shadow-md">
          <CardHeader className="pb-2 flex flex-row items-center justify-between space-y-0">
            <span className="text-xs text-emerald-300 font-semibold flex items-center gap-1">
              <Sparkles className="h-3.5 w-3.5 text-emerald-400" />
              วันคุมดีทั้งคู่ (Couple Win)
            </span>
            <div className="p-1.5 bg-emerald-500/20 text-emerald-400 rounded-lg">
              <CheckCircle2 className="h-4 w-4" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-extrabold text-emerald-400 font-mono">
                {monthlyStats.bothGoodDays}
              </span>
              <span className="text-xs text-slate-400 font-sans">วัน</span>
            </div>
            <p className="text-[11px] text-emerald-300/80 mt-1">
              🌟 ทั้งชายและหญิงคุมสำเร็จพร้อมกัน
            </p>
          </CardContent>
        </Card>

        {/* Card 2: สรุปฝ่ายชาย */}
        <Card className="bg-gradient-to-br from-[#0d1729] to-[#121f37] border border-emerald-500/30 shadow-md">
          <CardHeader className="pb-2 flex flex-row items-center justify-between space-y-0">
            <span className="text-xs text-emerald-300 font-semibold flex items-center gap-1">
              <span>🏋️‍♂️</span> ฝ่ายชาย (ดี vs ร้าย)
            </span>
            <span className="text-[10px] text-emerald-400 font-mono font-bold bg-emerald-500/10 px-2 py-0.5 rounded">
              {monthlyStats.maleAdherence}% คุมดี
            </span>
          </CardHeader>
          <CardContent>
            <div className="flex items-baseline gap-3">
              <div className="flex items-baseline gap-1">
                <span className="text-2xl font-extrabold text-emerald-400 font-mono">
                  {monthlyStats.maleGoodDays}
                </span>
                <span className="text-[10px] text-emerald-300">ดี</span>
              </div>
              <span className="text-slate-600">/</span>
              <div className="flex items-baseline gap-1">
                <span className="text-2xl font-extrabold text-rose-400 font-mono">
                  {monthlyStats.maleBadDays}
                </span>
                <span className="text-[10px] text-rose-300">หลุด</span>
              </div>
            </div>
            <p className="text-[11px] text-slate-400 mt-1">
              เป้า {maleTargetIntake.toLocaleString()} kcal • สถิติต่อเนื่อง {monthlyStats.maleLongestStreak} วัน
            </p>
          </CardContent>
        </Card>

        {/* Card 3: สรุปฝ่ายหญิง */}
        <Card className="bg-gradient-to-br from-[#22101e] to-[#2b1426] border border-pink-500/30 shadow-md">
          <CardHeader className="pb-2 flex flex-row items-center justify-between space-y-0">
            <span className="text-xs text-pink-300 font-semibold flex items-center gap-1">
              <span>🧘‍♀️</span> ฝ่ายหญิง (ดี vs ร้าย)
            </span>
            <span className="text-[10px] text-pink-400 font-mono font-bold bg-pink-500/10 px-2 py-0.5 rounded">
              {monthlyStats.femaleAdherence}% คุมดี
            </span>
          </CardHeader>
          <CardContent>
            <div className="flex items-baseline gap-3">
              <div className="flex items-baseline gap-1">
                <span className="text-2xl font-extrabold text-emerald-400 font-mono">
                  {monthlyStats.femaleGoodDays}
                </span>
                <span className="text-[10px] text-emerald-300">ดี</span>
              </div>
              <span className="text-slate-600">/</span>
              <div className="flex items-baseline gap-1">
                <span className="text-2xl font-extrabold text-rose-400 font-mono">
                  {monthlyStats.femaleBadDays}
                </span>
                <span className="text-[10px] text-rose-300">หลุด</span>
              </div>
            </div>
            <p className="text-[11px] text-slate-400 mt-1">
              เป้า {femaleTargetIntake.toLocaleString()} kcal • สถิติต่อเนื่อง {monthlyStats.femaleLongestStreak} วัน
            </p>
          </CardContent>
        </Card>

        {/* Card 4: การแข่งขันคู่รัก (ใครวินัยนำ) */}
        <Card className="bg-gradient-to-br from-[#1b1710] to-[#251f15] border border-amber-500/40 shadow-md">
          <CardHeader className="pb-2 flex flex-row items-center justify-between space-y-0">
            <span className="text-xs text-amber-300 font-semibold flex items-center gap-1">
              <Trophy className="h-3.5 w-3.5 text-amber-400" />
              การแข่งขันคู่รัก (Leader)
            </span>
            <div className="p-1.5 bg-amber-500/20 text-amber-400 rounded-lg">
              <Flame className="h-4 w-4" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-base font-bold text-white flex items-center gap-2">
              {monthlyStats.maleGoodDays > monthlyStats.femaleGoodDays ? (
                <span className="text-emerald-400 flex items-center gap-1">
                  <span>🏋️‍♂️ ฝ่ายชายนำ</span>
                  <span className="text-xs font-normal text-slate-400">
                    (+{monthlyStats.maleGoodDays - monthlyStats.femaleGoodDays} วัน)
                  </span>
                </span>
              ) : monthlyStats.femaleGoodDays > monthlyStats.maleGoodDays ? (
                <span className="text-pink-400 flex items-center gap-1">
                  <span>🧘‍♀️ ฝ่ายหญิงนำ</span>
                  <span className="text-xs font-normal text-slate-400">
                    (+{monthlyStats.femaleGoodDays - monthlyStats.maleGoodDays} วัน)
                  </span>
                </span>
              ) : (
                <span className="text-amber-300">🤝 เสมอกันสุดสูสี!</span>
              )}
            </div>
            <p className="text-[11px] text-amber-300/80 mt-1">
              สถิติคุมดีทั้งคู่ต่อเนื่อง {monthlyStats.coupleLongestStreak} วันติด 🔥
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Month Navigator & Criteria Filters Bar */}
      <div className="flex flex-col md:flex-row items-center justify-between gap-3 bg-[#111726] border border-[#26334d] p-3 rounded-xl">
        {/* Month Navigation */}
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handlePrevMonth}
            className="border-[#26334d] bg-[#0b0f19] text-slate-300 hover:text-white hover:bg-slate-800 h-8 px-2.5"
            title="เดือนก่อนหน้า"
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>

          <div className="px-3 py-1 bg-[#0b0f19] border border-[#26334d] rounded-lg text-sm font-bold text-white font-mono flex items-center gap-2">
            <Calendar className="h-4 w-4 text-emerald-400" />
            <span>
              {THAI_MONTHS[selectedMonth]} {selectedYear + 543}
            </span>
            <span className="text-xs text-slate-400 font-normal">
              ({new Date(selectedYear, selectedMonth, 1).toLocaleString("en-US", { month: "short" })}{" "}
              {selectedYear})
            </span>
          </div>

          <Button
            variant="outline"
            size="sm"
            onClick={handleNextMonth}
            className="border-[#26334d] bg-[#0b0f19] text-slate-300 hover:text-white hover:bg-slate-800 h-8 px-2.5"
            title="เดือนถัดไป"
          >
            <ChevronRight className="h-4 w-4" />
          </Button>

          <Button
            variant="ghost"
            size="sm"
            onClick={handleJumpToToday}
            className="text-xs text-slate-400 hover:text-white hover:bg-slate-800 h-8 px-2"
          >
            วันนี้
          </Button>
        </div>

        {/* Criteria Selection: แคลอรี่ / ก้าวเดิน / โปรตีน / การนอน / รวม */}
        <div className="flex items-center gap-1 bg-[#0b0f19] p-1 rounded-lg border border-[#26334d] text-xs flex-wrap">
          <span className="text-[11px] text-slate-400 px-2 font-medium hidden sm:inline">
            กรองรูทีนดี/ร้าย:
          </span>
          <button
            type="button"
            onClick={() => setCriteria("calories")}
            className={`px-2.5 py-1 rounded-md transition-all font-medium flex items-center gap-1 ${
              criteria === "calories"
                ? "bg-emerald-600 text-white font-semibold shadow-sm"
                : "text-slate-400 hover:text-white"
            }`}
          >
            <Utensils className="h-3 w-3" />
            <span>คุมแคลอรี่</span>
          </button>
          <button
            type="button"
            onClick={() => setCriteria("steps")}
            className={`px-2.5 py-1 rounded-md transition-all font-medium flex items-center gap-1 ${
              criteria === "steps"
                ? "bg-indigo-600 text-white font-semibold shadow-sm"
                : "text-slate-400 hover:text-white"
            }`}
          >
            <Footprints className="h-3 w-3" />
            <span>ก้าวเดิน</span>
          </button>
          <button
            type="button"
            onClick={() => setCriteria("protein")}
            className={`px-2.5 py-1 rounded-md transition-all font-medium flex items-center gap-1 ${
              criteria === "protein"
                ? "bg-amber-600 text-white font-semibold shadow-sm"
                : "text-slate-400 hover:text-white"
            }`}
          >
            <Beef className="h-3 w-3" />
            <span>โปรตีน</span>
          </button>
          <button
            type="button"
            onClick={() => setCriteria("sleep")}
            className={`px-2.5 py-1 rounded-md transition-all font-medium flex items-center gap-1 ${
              criteria === "sleep"
                ? "bg-sky-600 text-white font-semibold shadow-sm"
                : "text-slate-400 hover:text-white"
            }`}
          >
            <Moon className="h-3 w-3" />
            <span>การนอน</span>
          </button>
          <button
            type="button"
            onClick={() => setCriteria("all")}
            className={`px-2.5 py-1 rounded-md transition-all font-medium flex items-center gap-1 ${
              criteria === "all"
                ? "bg-teal-600 text-white font-semibold shadow-sm"
                : "text-slate-400 hover:text-white"
            }`}
          >
            <Sparkles className="h-3 w-3" />
            <span>ครบสูตร</span>
          </button>
        </div>
      </div>

      {/* Interactive Month Calendar Grid */}
      <Card className="bg-[#111726] border-[#26334d] shadow-xl overflow-hidden">
        {/* Weekday Headers */}
        <div className="grid grid-cols-7 border-b border-[#26334d] bg-[#0c1220] text-center text-[11px] sm:text-xs font-semibold text-slate-400 py-2 sm:py-2.5">
          <div className="text-rose-400">
            <span className="hidden sm:inline">อาทิตย์ (Sun)</span>
            <span className="sm:hidden">อา.</span>
          </div>
          <div>
            <span className="hidden sm:inline">จันทร์ (Mon)</span>
            <span className="sm:hidden">จ.</span>
          </div>
          <div>
            <span className="hidden sm:inline">อังคาร (Tue)</span>
            <span className="sm:hidden">อ.</span>
          </div>
          <div>
            <span className="hidden sm:inline">พุธ (Wed)</span>
            <span className="sm:hidden">พ.</span>
          </div>
          <div>
            <span className="hidden sm:inline">พฤหัสบดี (Thu)</span>
            <span className="sm:hidden">พฤ.</span>
          </div>
          <div className="text-cyan-400">
            <span className="hidden sm:inline">ศุกร์ (Fri)</span>
            <span className="sm:hidden">ศ.</span>
          </div>
          <div className="text-amber-400">
            <span className="hidden sm:inline">เสาร์ (Sat)</span>
            <span className="sm:hidden">ส.</span>
          </div>
        </div>

        {/* Days Grid */}
        <div className="grid grid-cols-7 gap-px bg-[#26334d]/40 p-px">
          {/* Leading empty cells for calendar alignment */}
          {Array.from({ length: firstDayOffset }).map((_, idx) => (
            <div
              key={`empty-${idx}`}
              className="min-h-[90px] sm:min-h-[135px] bg-[#0d1424]/30 p-1 sm:p-2 opacity-30 cursor-default"
            />
          ))}

          {/* Actual days in month */}
          {monthDays.map((day) => {
            const isGood = isAll ? day.coupleStatus === "both_good" : day.activeStatus === "good"
            const isMaintain = !isAll && day.activeStatus === "maintain"
            const isBad = isAll ? day.coupleStatus === "both_bad" : day.activeStatus === "bad"
            const isFuture = day.isFuture

            return (
              <div
                key={day.dateStr}
                onClick={() => openDayDetails(day)}
                className={`min-h-[90px] sm:min-h-[135px] p-1.5 sm:p-2 flex flex-col justify-between transition-all cursor-pointer relative group ${
                  day.isToday
                    ? "ring-2 ring-emerald-400 z-10 shadow-lg shadow-emerald-950/40"
                    : ""
                } ${
                  isGood
                    ? "bg-gradient-to-br from-[#0c1c1b] to-[#112423] hover:from-[#0e2423] hover:to-[#152e2c]"
                    : isMaintain
                    ? "bg-gradient-to-br from-[#211b0d] to-[#261f0f] hover:from-[#2b2311] hover:to-[#302713]"
                    : isBad
                    ? "bg-gradient-to-br from-[#201016] to-[#251520] hover:from-[#2a131c] hover:to-[#2e1724]"
                    : isFuture
                    ? "bg-[#0b0f19]/40 opacity-50 hover:opacity-80"
                    : "bg-[#0d1424]/60 hover:bg-[#121b2f]"
                }`}
              >
                {/* Day Header Row: Date number & Status badge */}
                <div className="flex items-start justify-between gap-1">
                  <div className="flex items-center gap-1">
                    <span
                      className={`text-xs sm:text-sm font-bold font-mono ${
                        day.isToday
                          ? "bg-emerald-500 text-slate-950 px-1.5 py-0.2 rounded-md font-extrabold"
                          : day.dayOfWeek === 0
                          ? "text-rose-400"
                          : day.dayOfWeek === 6
                          ? "text-amber-400"
                          : "text-slate-200"
                      }`}
                    >
                      {day.dayNum}
                    </span>
                    {day.isToday && (
                      <span className="text-[9px] text-emerald-400 font-semibold hidden sm:inline">
                        วันนี้
                      </span>
                    )}
                  </div>

                  {/* Main Badge */}
                  {isAll ? (
                    <Badge
                      className={`text-[8px] sm:text-[9px] px-1 sm:px-1.5 py-0 border-none shadow-sm font-bold flex items-center gap-0.5 shrink-0 ${day.coupleStatusBadgeColor}`}
                    >
                      {day.coupleStatus === "both_good" && <CheckCircle2 className="h-2.5 w-2.5 sm:h-3 sm:w-3 stroke-[3]" />}
                      {day.coupleStatus === "both_bad" && <XCircle className="h-2.5 w-2.5 sm:h-3 sm:w-3" />}
                      <span className="hidden sm:inline truncate">{day.coupleStatusLabel}</span>
                      <span className="sm:hidden truncate">{day.coupleStatusShortLabel}</span>
                    </Badge>
                  ) : (
                    <>
                      {day.activeStatus === "good" && (
                        <Badge className="bg-emerald-500 text-slate-950 font-extrabold text-[9px] sm:text-[10px] px-1 sm:px-1.5 py-0 flex items-center gap-0.5 shadow-sm border-none">
                          <CheckCircle2 className="h-2.5 w-2.5 sm:h-3 sm:w-3 stroke-[3]" />
                          <span className="hidden sm:inline">ดี</span>
                        </Badge>
                      )}
                      {day.activeStatus === "maintain" && (
                        <Badge className="bg-amber-500 text-slate-950 font-extrabold text-[9px] sm:text-[10px] px-1 sm:px-1.5 py-0 flex items-center gap-0.5 shadow-sm border-none">
                          <span className="hidden sm:inline">ประคอง</span>
                          <span className="sm:hidden">🟡</span>
                        </Badge>
                      )}
                      {day.activeStatus === "bad" && (
                        <Badge className="bg-rose-500 text-white font-extrabold text-[9px] sm:text-[10px] px-1 sm:px-1.5 py-0 flex items-center gap-0.5 shadow-sm border-none">
                          <XCircle className="h-2.5 w-2.5 sm:h-3 sm:w-3 stroke-[2.5]" />
                          <span className="hidden sm:inline">หลุด</span>
                        </Badge>
                      )}
                      {day.activeStatus === "unrecorded" && (
                        <span className="text-[9px] sm:text-[10px] text-slate-600 font-mono">--</span>
                      )}
                    </>
                  )}
                </div>

                {/* Mid Section: รวมชายหญิง (แสดง 2 แถว ชาย vs หญิง แยกชัดเจน) */}
                {isAll ? (
                  <div className="space-y-0.5 sm:space-y-1 my-1">
                    {/* Male Row */}
                    <div
                      className={`flex items-center justify-between text-[9px] sm:text-[10px] font-mono px-1 sm:px-1.5 py-0.5 rounded transition-all ${
                        day.male.status === "good"
                          ? "bg-emerald-950/40 text-emerald-300 border border-emerald-500/30"
                          : day.male.status === "maintain"
                          ? "bg-amber-950/40 text-amber-300 border border-amber-500/30"
                          : day.male.status === "bad"
                          ? "bg-rose-950/40 text-rose-300 border border-rose-500/30"
                          : "text-slate-500 bg-[#0b0f19]/30"
                      }`}
                    >
                      <span className="flex items-center gap-0.5 sm:gap-1 font-semibold truncate">
                        <span>🏋️‍♂️</span>
                        {criteria === "steps" ? (
                          day.male.stepCount > 0 ? (
                            <span>{day.male.stepCount.toLocaleString()}ก้าว</span>
                          ) : (
                            <span className="text-slate-600">--</span>
                          )
                        ) : criteria === "protein" ? (
                          day.male.totalProtein > 0 ? (
                            <span>{day.male.totalProtein}g</span>
                          ) : (
                            <span className="text-slate-600">--</span>
                          )
                        ) : criteria === "sleep" ? (
                          day.male.sleepLog ? (
                            <span>{day.male.sleepLog.durationHours}ชม.</span>
                          ) : (
                            <span className="text-slate-600">--</span>
                          )
                        ) : day.male.totalCalories > 0 ? (
                          <span>{day.male.totalCalories.toLocaleString()}</span>
                        ) : (
                          <span className="text-slate-600">--</span>
                        )}
                      </span>
                      <span className="shrink-0">
                        {day.male.status === "good" ? "✅" : day.male.status === "maintain" ? "🟡" : day.male.status === "bad" ? "❌" : ""}
                      </span>
                    </div>

                    {/* Female Row */}
                    <div
                      className={`flex items-center justify-between text-[9px] sm:text-[10px] font-mono px-1 sm:px-1.5 py-0.5 rounded transition-all ${
                        day.female.status === "good"
                          ? "bg-pink-950/40 text-pink-300 border border-pink-500/30"
                          : day.female.status === "maintain"
                          ? "bg-amber-950/40 text-amber-300 border border-amber-500/30"
                          : day.female.status === "bad"
                          ? "bg-rose-950/40 text-rose-300 border border-rose-500/30"
                          : "text-slate-500 bg-[#0b0f19]/30"
                      }`}
                    >
                      <span className="flex items-center gap-0.5 sm:gap-1 font-semibold truncate">
                        <span>🧘‍♀️</span>
                        {criteria === "steps" ? (
                          day.female.stepCount > 0 ? (
                            <span>{day.female.stepCount.toLocaleString()}ก้าว</span>
                          ) : (
                            <span className="text-slate-600">--</span>
                          )
                        ) : criteria === "protein" ? (
                          day.female.totalProtein > 0 ? (
                            <span>{day.female.totalProtein}g</span>
                          ) : (
                            <span className="text-slate-600">--</span>
                          )
                        ) : criteria === "sleep" ? (
                          day.female.sleepLog ? (
                            <span>{day.female.sleepLog.durationHours}ชม.</span>
                          ) : (
                            <span className="text-slate-600">--</span>
                          )
                        ) : day.female.totalCalories > 0 ? (
                          <span>{day.female.totalCalories.toLocaleString()}</span>
                        ) : (
                          <span className="text-slate-600">--</span>
                        )}
                      </span>
                      <span className="shrink-0">
                        {day.female.status === "good" ? "✅" : day.female.status === "maintain" ? "🟡" : day.female.status === "bad" ? "❌" : ""}
                      </span>
                    </div>
                  </div>
                ) : (
                  /* Single Person Mid Section (Dynamic by criteria) */
                  <div className="my-1 space-y-0.5">
                    {(() => {
                      const pStats = isFemale ? day.female : day.male
                      if (criteria === "steps") {
                        return pStats.stepCount > 0 ? (
                          <div>
                            <div className="text-[11px] sm:text-xs font-mono font-bold text-indigo-300 leading-tight">
                              {pStats.stepCount.toLocaleString()}
                              <span className="text-[9px] text-slate-400 font-normal"> ก้าว</span>
                            </div>
                            <div className="text-[9px] text-slate-400">
                              เป้า {pStats.targetSteps.toLocaleString()}
                            </div>
                          </div>
                        ) : !isFuture ? (
                          <span className="text-[9px] sm:text-[10px] text-slate-500">ไม่ได้จดก้าว</span>
                        ) : null
                      }
                      if (criteria === "protein") {
                        return pStats.totalProtein > 0 ? (
                          <div>
                            <div className="text-[11px] sm:text-xs font-mono font-bold text-amber-300 leading-tight">
                              {pStats.totalProtein}g
                              <span className="text-[9px] text-slate-400 font-normal">
                                {" "}/ {pStats.targetProtein}g
                              </span>
                            </div>
                          </div>
                        ) : !isFuture ? (
                          <span className="text-[9px] sm:text-[10px] text-slate-500">ไม่ได้จดโปรตีน</span>
                        ) : null
                      }
                      if (criteria === "sleep") {
                        return pStats.sleepLog ? (
                          <div>
                            <div className="text-[11px] sm:text-xs font-mono font-bold text-sky-300 leading-tight">
                              {pStats.sleepLog.durationHours} ชม.
                            </div>
                            <div className="text-[9px] text-slate-400 font-mono">
                              {pStats.sleepLog.bedTime}-{pStats.sleepLog.wakeTime}
                            </div>
                          </div>
                        ) : !isFuture ? (
                          <span className="text-[9px] sm:text-[10px] text-slate-500">ไม่ได้จดเวลานอน</span>
                        ) : null
                      }
                      return day.activeCalories > 0 ? (
                        <div>
                          <div
                            className={`text-[11px] sm:text-xs font-mono font-bold leading-tight ${
                              day.activeStatus === "good"
                                ? "text-emerald-300"
                                : day.activeStatus === "maintain"
                                ? "text-amber-300"
                                : "text-rose-400"
                            }`}
                          >
                            {day.activeCalories.toLocaleString()}
                            <span className="text-[9px] sm:text-[10px] text-slate-400 font-normal">
                              {" "}
                              / {day.activeTargetCalories.toLocaleString()}
                            </span>
                          </div>
                          <div className="text-[9px] sm:text-[10px] leading-none">
                            <span
                              className={
                                day.activeStatus === "good"
                                  ? "text-emerald-400"
                                  : day.activeStatus === "maintain"
                                  ? "text-amber-400 font-semibold"
                                  : "text-rose-400 font-semibold"
                              }
                            >
                              {day.activeMaintenanceDiff <= 0
                                ? `+${Math.abs(day.activeMaintenanceDiff).toLocaleString()} kcal`
                                : `-${day.activeMaintenanceDiff.toLocaleString()} kcal`}
                            </span>
                          </div>
                        </div>
                      ) : !isFuture ? (
                        <span className="text-[9px] sm:text-[10px] text-slate-500">ไม่ได้จดอาหาร</span>
                      ) : null
                    })()}
                  </div>
                )}

                {/* Bottom Row: Activities & Quick indicators */}
                <div className="flex items-center justify-between text-[9px] sm:text-[10px] text-slate-400 pt-1 border-t border-[#26334d]/40">
                  <div className="flex items-center gap-0.5 sm:gap-1">
                    {day.male.meals.length + day.female.meals.length > 0 && (
                      <span className="text-emerald-400 font-mono text-[9px] sm:text-[10px]" title="มื้ออาหาร">
                        🍽️{day.male.meals.length + day.female.meals.length}
                      </span>
                    )}
                    {day.male.stepCount + day.female.stepCount > 0 && (
                      <span className="text-indigo-400 font-mono text-[9px] sm:text-[10px]" title="ก้าวเดิน">
                        👟
                      </span>
                    )}
                    {(day.male.sleepLog || day.female.sleepLog) && (
                      <span className="text-sky-400 font-mono text-[9px] sm:text-[10px]" title="บันทึกเวลานอนแล้ว">
                        😴
                      </span>
                    )}
                  </div>
                  {day.male.weight || day.female.weight ? (
                    <span className="text-cyan-400 font-mono text-[8px] sm:text-[9px]">
                      ⚖️{isAll ? `${day.male.weight || "-"}/${day.female.weight || "-"}` : day.activeWeight}
                    </span>
                  ) : null}
                </div>
              </div>
            )
          })}
        </div>
      </Card>

      {/* Legend / Guidance Note */}
      <div className="flex flex-wrap items-center justify-between gap-3 p-3.5 rounded-xl bg-[#111726] border border-[#26334d] text-xs text-slate-400">
        <div className="flex items-center gap-4 flex-wrap">
          <span className="font-semibold text-slate-300">สัญลักษณ์ปฏิทิน:</span>
          <div className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-full bg-emerald-500 inline-block" />
            <span className="text-emerald-300 font-medium">🌟 ดีทั้งคู่ (คุมดีพร้อมกัน)</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-full bg-amber-500 inline-block" />
            <span className="text-amber-300">🏋️‍♂️ ชายดี (หญิงเกิน)</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-full bg-pink-500 inline-block" />
            <span className="text-pink-300">🧘‍♀️ หญิงดี (ชายเกิน)</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-full bg-rose-500 inline-block" />
            <span className="text-rose-300">❌ หลุดคู่</span>
          </div>
        </div>

        <span className="text-[11px] text-slate-500">
          💡 คลิกที่ช่องวัน เพื่อดูรายละเอียดมื้ออาหารและน้ำหนักของทั้งชายและหญิง
        </span>
      </div>

      {/* Day Detail Dialog (รองรับแยกดูทั้ง ชาย vs หญิง) */}
      {selectedDay && (
        <Dialog open={dayModalOpen} onOpenChange={setDayModalOpen}>
          <DialogContent className="max-w-2xl bg-[#111726] border-[#26334d] text-white p-6 rounded-2xl shadow-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <div className="flex items-center justify-between">
                <span className="text-xs text-emerald-400 font-semibold flex items-center gap-1">
                  <Users className="h-3.5 w-3.5" />
                  สรุปผลรายวันคู่รัก
                </span>
                <span className="text-xs text-slate-400 font-mono">
                  {selectedDay.dateStr}
                </span>
              </div>
              <DialogTitle className="text-xl font-bold flex items-center gap-2 text-white">
                <span>📅</span> {formatThaiDate(selectedDay.dateStr)}
              </DialogTitle>
            </DialogHeader>

            {/* Couple Status Banner */}
            <div
              className={`p-3.5 rounded-xl border flex items-center justify-between gap-3 ${
                selectedDay.coupleStatus === "both_good"
                  ? "bg-emerald-950/40 border-emerald-500/50 text-emerald-300"
                  : selectedDay.coupleStatus === "both_bad"
                  ? "bg-rose-950/40 border-rose-500/50 text-rose-300"
                  : selectedDay.coupleStatus === "male_only" || selectedDay.coupleStatus === "female_only"
                  ? "bg-amber-950/40 border-amber-500/40 text-amber-300"
                  : "bg-slate-900 border-[#26334d] text-slate-300"
              }`}
            >
              <div className="flex items-center gap-2.5">
                {selectedDay.coupleStatus === "both_good" ? (
                  <CheckCircle2 className="h-6 w-6 text-emerald-400 shrink-0" />
                ) : selectedDay.coupleStatus === "both_bad" ? (
                  <XCircle className="h-6 w-6 text-rose-400 shrink-0" />
                ) : (
                  <Sparkles className="h-6 w-6 text-amber-400 shrink-0" />
                )}
                <div>
                  <strong className="text-sm block">
                    {selectedDay.coupleStatus === "both_good"
                      ? "วันคุมดีทั้งคู่ (Both Won) 🌟"
                      : selectedDay.coupleStatus === "both_bad"
                      ? "วันหลุดเป้าทั้งคู่ (Both Missed) ⚠️"
                      : selectedDay.coupleStatus === "male_only"
                      ? "ฝ่ายชายคุมดี (ฝ่ายหญิงหลุดเป้า) 🏋️‍♂️"
                      : selectedDay.coupleStatus === "female_only"
                      ? "ฝ่ายหญิงคุมดี (ฝ่ายชายหลุดเป้า) 🧘‍♀️"
                      : selectedDay.isFuture
                      ? "วันข้างหน้า (ยังไม่ถึงวัน)"
                      : "ยังไม่มีการบันทึกข้อมูล"}
                  </strong>
                  <span className="text-xs opacity-90">
                    ชาย: {selectedDay.male.totalCalories}/{maleTargetIntake} kcal ({selectedDay.male.statusLabel}) • หญิง: {selectedDay.female.totalCalories}/{femaleTargetIntake} kcal ({selectedDay.female.statusLabel})
                  </span>
                </div>
              </div>
            </div>

            {/* Toggle Tabs for Day Detail: Both vs Male vs Female */}
            <div className="flex rounded-xl bg-[#0b0f19] p-1 border border-[#26334d]">
              <button
                type="button"
                onClick={() => setDetailTab("both")}
                className={`flex-1 py-1.5 text-xs font-semibold rounded-lg transition-all ${
                  detailTab === "both"
                    ? "bg-indigo-600 text-white shadow-sm font-bold"
                    : "text-slate-400 hover:text-white"
                }`}
              >
                👥 สรุปคู่รัก (ทั้งสองคน)
              </button>
              <button
                type="button"
                onClick={() => setDetailTab("male")}
                className={`flex-1 py-1.5 text-xs font-semibold rounded-lg transition-all ${
                  detailTab === "male"
                    ? "bg-emerald-600 text-white shadow-sm font-bold"
                    : "text-slate-400 hover:text-white"
                }`}
              >
                🏋️‍♂️ ฝ่ายชาย ({selectedDay.male.meals.length} มื้อ)
              </button>
              <button
                type="button"
                onClick={() => setDetailTab("female")}
                className={`flex-1 py-1.5 text-xs font-semibold rounded-lg transition-all ${
                  detailTab === "female"
                    ? "bg-pink-600 text-white shadow-sm font-bold"
                    : "text-slate-400 hover:text-white"
                }`}
              >
                🧘‍♀️ ฝ่ายหญิง ({selectedDay.female.meals.length} มื้อ)
              </button>
            </div>

            {/* Section: Both View (Split Cards) */}
            {(detailTab === "both" || detailTab === "male") && (
              <div className="space-y-2 p-3 rounded-xl bg-[#0d1527] border border-emerald-500/30">
                <div className="flex items-center justify-between flex-wrap gap-1">
                  <div className="flex items-center gap-1.5 font-bold text-emerald-400 text-sm">
                    <span>🏋️‍♂️</span>
                    <span>ฝ่ายชาย: {selectedDay.male.statusLabel}</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    {onOpenAddSleep && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          setDayModalOpen(false)
                          onOpenAddSleep(selectedDay.dateStr, "ฝ่ายชาย")
                        }}
                        className="h-6 text-[11px] border-sky-500/40 text-sky-300 hover:bg-sky-600 hover:text-white px-2"
                      >
                        <Moon className="h-3 w-3 mr-1" />
                        เวลานอนชาย
                      </Button>
                    )}
                    {onOpenAddMeal && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          setDayModalOpen(false)
                          onOpenAddMeal(selectedDay.dateStr, "ฝ่ายชาย")
                        }}
                        className="h-6 text-[11px] border-emerald-500/40 text-emerald-300 hover:bg-emerald-600 hover:text-white px-2"
                      >
                        <Plus className="h-3 w-3 mr-1" />
                        เพิ่มอาหารชาย
                      </Button>
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-5 gap-2 text-center font-mono text-xs">
                  <div className="p-2 rounded-lg bg-[#0b0f19] border border-[#26334d]">
                    <span className="text-[10px] text-slate-400 block font-sans">แคลอรี่</span>
                    <strong className={selectedDay.male.calorieDiff >= 0 ? "text-emerald-400" : "text-rose-400"}>
                      {selectedDay.male.totalCalories}
                    </strong>
                    <span className="text-[9px] text-slate-500 block">/ {maleTargetIntake}</span>
                  </div>
                  <div className="p-2 rounded-lg bg-[#0b0f19] border border-[#26334d]">
                    <span className="text-[10px] text-slate-400 block font-sans">โปรตีน</span>
                    <strong className="text-emerald-300">{selectedDay.male.totalProtein}g</strong>
                    <span className="text-[9px] text-slate-500 block">/ {maleProteinTarget}g</span>
                  </div>
                  <div className="p-2 rounded-lg bg-[#0b0f19] border border-[#26334d]">
                    <span className="text-[10px] text-slate-400 block font-sans">ก้าวเดิน</span>
                    <strong className="text-indigo-300">{selectedDay.male.stepCount.toLocaleString()}</strong>
                    <span className="text-[9px] text-slate-500 block">/ {maleStepTarget.toLocaleString()}</span>
                  </div>
                  <div className="p-2 rounded-lg bg-[#0b0f19] border border-[#26334d]">
                    <span className="text-[10px] text-slate-400 block font-sans">น้ำหนักเช้า</span>
                    <strong className="text-cyan-300">{selectedDay.male.weight ? `${selectedDay.male.weight} kg` : "--"}</strong>
                    <span className="text-[9px] text-slate-500 block">ชั่งเช้า</span>
                  </div>
                  <div className="p-2 rounded-lg bg-[#0b0f19] border border-[#26334d]">
                    <span className="text-[10px] text-slate-400 block font-sans">เวลานอน</span>
                    <strong className="text-sky-300">
                      {selectedDay.male.sleepLog
                        ? calculateSleepDuration(
                            selectedDay.male.sleepLog.bedTime,
                            selectedDay.male.sleepLog.wakeTime
                          ).shortFormatted
                        : "--"}
                    </strong>
                    <span className="text-[9px] text-slate-500 block">
                      {selectedDay.male.sleepLog
                        ? `${selectedDay.male.sleepLog.bedTime}-${selectedDay.male.sleepLog.wakeTime}`
                        : "ยังไม่จด"}
                    </span>
                  </div>
                </div>

                {/* Male Meals List */}
                {selectedDay.male.meals.length > 0 && (
                  <div className="space-y-1 pt-1 max-h-36 overflow-y-auto">
                    {selectedDay.male.meals.map((m: any, idx: number) => (
                      <div key={idx} className="p-1.5 rounded bg-[#0b0f19] border border-[#26334d] flex justify-between text-xs">
                        <span>{m.mealType || m.MealType} • {m.foodName || m.FoodName} ({m.servings || 1} เสิร์ฟ)</span>
                        <span className="font-mono text-emerald-400 font-bold">{m.calories || m.Calories} kcal</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {(detailTab === "both" || detailTab === "female") && (
              <div className="space-y-2 p-3 rounded-xl bg-[#20101b] border border-pink-500/30">
                <div className="flex items-center justify-between flex-wrap gap-1">
                  <div className="flex items-center gap-1.5 font-bold text-pink-400 text-sm">
                    <span>🧘‍♀️</span>
                    <span>ฝ่ายหญิง: {selectedDay.female.statusLabel}</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    {onOpenAddSleep && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          setDayModalOpen(false)
                          onOpenAddSleep(selectedDay.dateStr, "ฝ่ายหญิง")
                        }}
                        className="h-6 text-[11px] border-sky-500/40 text-sky-300 hover:bg-sky-600 hover:text-white px-2"
                      >
                        <Moon className="h-3 w-3 mr-1" />
                        เวลานอนหญิง
                      </Button>
                    )}
                    {onOpenAddMeal && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          setDayModalOpen(false)
                          onOpenAddMeal(selectedDay.dateStr, "ฝ่ายหญิง")
                        }}
                        className="h-6 text-[11px] border-pink-500/40 text-pink-300 hover:bg-pink-600 hover:text-white px-2"
                      >
                        <Plus className="h-3 w-3 mr-1" />
                        เพิ่มอาหารหญิง
                      </Button>
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-5 gap-2 text-center font-mono text-xs">
                  <div className="p-2 rounded-lg bg-[#0b0f19] border border-[#26334d]">
                    <span className="text-[10px] text-slate-400 block font-sans">แคลอรี่</span>
                    <strong className={selectedDay.female.calorieDiff >= 0 ? "text-emerald-400" : "text-rose-400"}>
                      {selectedDay.female.totalCalories}
                    </strong>
                    <span className="text-[9px] text-slate-500 block">/ {femaleTargetIntake}</span>
                  </div>
                  <div className="p-2 rounded-lg bg-[#0b0f19] border border-[#26334d]">
                    <span className="text-[10px] text-slate-400 block font-sans">โปรตีน</span>
                    <strong className="text-pink-300">{selectedDay.female.totalProtein}g</strong>
                    <span className="text-[9px] text-slate-500 block">/ {femaleProteinTarget}g</span>
                  </div>
                  <div className="p-2 rounded-lg bg-[#0b0f19] border border-[#26334d]">
                    <span className="text-[10px] text-slate-400 block font-sans">ก้าวเดิน</span>
                    <strong className="text-indigo-300">{selectedDay.female.stepCount.toLocaleString()}</strong>
                    <span className="text-[9px] text-slate-500 block">/ {femaleStepTarget.toLocaleString()}</span>
                  </div>
                  <div className="p-2 rounded-lg bg-[#0b0f19] border border-[#26334d]">
                    <span className="text-[10px] text-slate-400 block font-sans">น้ำหนักเช้า</span>
                    <strong className="text-cyan-300">{selectedDay.female.weight ? `${selectedDay.female.weight} kg` : "--"}</strong>
                    <span className="text-[9px] text-slate-500 block">ชั่งเช้า</span>
                  </div>
                  <div className="p-2 rounded-lg bg-[#0b0f19] border border-[#26334d]">
                    <span className="text-[10px] text-slate-400 block font-sans">เวลานอน</span>
                    <strong className="text-sky-300">
                      {selectedDay.female.sleepLog
                        ? calculateSleepDuration(
                            selectedDay.female.sleepLog.bedTime,
                            selectedDay.female.sleepLog.wakeTime
                          ).shortFormatted
                        : "--"}
                    </strong>
                    <span className="text-[9px] text-slate-500 block">
                      {selectedDay.female.sleepLog
                        ? `${selectedDay.female.sleepLog.bedTime}-${selectedDay.female.sleepLog.wakeTime}`
                        : "ยังไม่จด"}
                    </span>
                  </div>
                </div>

                {/* Female Meals List */}
                {selectedDay.female.meals.length > 0 && (
                  <div className="space-y-1 pt-1 max-h-36 overflow-y-auto">
                    {selectedDay.female.meals.map((m: any, idx: number) => (
                      <div key={idx} className="p-1.5 rounded bg-[#0b0f19] border border-[#26334d] flex justify-between text-xs">
                        <span>{m.mealType || m.MealType} • {m.foodName || m.FoodName} ({m.servings || 1} เสิร์ฟ)</span>
                        <span className="font-mono text-pink-400 font-bold">{m.calories || m.Calories} kcal</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            <DialogFooter className="pt-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setDayModalOpen(false)}
                className="border-[#26334d] hover:bg-slate-800 text-slate-300 text-xs"
              >
                ปิดหน้าต่าง
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  )
}
