import * as React from "react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import {
  Flame,
  Beef,
  Wheat,
  Droplet,
  Plus,
  CheckCircle2,
  Calendar,
  TrendingUp,
  UtensilsCrossed,
  ArrowRight,
  Scale,
  Target,
  Sparkles,
  Zap,
  Sliders,
  Trophy,
  Crown,
  Medal,
  Award,
  Swords,
  Users,
  Clock,
  Lightbulb,
  Activity,
  Footprints,
  Pencil,
  ChevronLeft,
  ChevronRight,
  Moon,
  Sun,
} from "lucide-react"
import {
  AllCalorieSettings,
  getCalorieSettings,
  getIntakeTarget,
} from "@/lib/calorieSettings"
import {
  getActiveProject,
  FitnessProject,
  analyzeProject,
} from "@/lib/projectManager"
import { getDailyStepLogs } from "@/lib/exerciseDatabase"
import {
  getSleepLogs,
  calculateSleepDuration,
  getSleepGoal,
  evaluateSleepStatus,
  isLateBedtime,
} from "@/lib/sleepTracker"
import { CalorieSettingsModal } from "@/components/modals/CalorieSettingsModal"
import { ProjectReviewModal } from "@/components/modals/ProjectReviewModal"
import { SetStepGoalModal } from "@/components/modals/SetStepGoalModal"
import { EditProjectModal } from "@/components/modals/EditProjectModal"
import { formatThaiDate } from "@/lib/utils"
import { groupMealsByFoodCategory, getFoodGroupTargets } from "@/lib/mealCategories"
import { Doughnut, Bar } from "react-chartjs-2"
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  PointElement,
  LineElement,
  ArcElement,
  Title,
  Tooltip,
  Legend,
} from "chart.js"

ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  PointElement,
  LineElement,
  ArcElement,
  Title,
  Tooltip,
  Legend
)

interface DashboardViewProps {
  meals: any[]
  foods: any[]
  healthLogs: any[]
  selectedPerson: string
  onSelectPerson: (person: string) => void
  onOpenAddMeal: (date?: string) => void
  onOpenAddWeight: () => void
  onOpenAddStep?: () => void
  onOpenAddSleep?: (date?: string, person?: string) => void
  onToggleMealStatus: (id: string, currentStatus: string) => void
  onNavigateToMealPlan: () => void
  onNavigateToCalendar?: () => void
  onNavigateToSleep?: () => void
}

export function DashboardView({
  meals,
  foods,
  healthLogs,
  selectedPerson,
  onSelectPerson,
  onOpenAddMeal,
  onOpenAddWeight,
  onOpenAddStep,
  onOpenAddSleep,
  onToggleMealStatus,
  onNavigateToMealPlan,
  onNavigateToCalendar,
  onNavigateToSleep,
}: DashboardViewProps) {
  const isAll = selectedPerson === "ALL" || selectedPerson === "ทั้งหมด"
  const isMale = selectedPerson === "ฝ่ายชาย"
  const isFemale = selectedPerson === "ฝ่ายหญิง"

  // Calorie & TDEE Settings from localStorage / Defaults
  const [calorieSettings, setCalorieSettings] = React.useState<AllCalorieSettings>(getCalorieSettings)
  const [calorieModalOpen, setCalorieModalOpen] = React.useState(false)

  React.useEffect(() => {
    setCalorieSettings(getCalorieSettings())
  }, [selectedPerson, meals, healthLogs])

  // Male Base Settings (from Google Sheet)
  const maleSettings = calorieSettings.male
  const maleMaintenance = maleSettings.maintenance || 0
  const maleDeficitTarget = maleSettings.deficit || 0
  const maleTargetIntake = getIntakeTarget(maleSettings)
  const maleTargetProtein = maleSettings.protein || 0
  const maleTargetCarbs = maleSettings.carbs || 0
  const maleTargetFat = maleSettings.fat || 0
  const maleStartWeight = 100.0
  const maleGoalWeight = 70.0

  // Female Base Settings (from Google Sheet)
  const femaleSettings = calorieSettings.female
  const femaleMaintenance = femaleSettings.maintenance || 0
  const femaleDeficitTarget = femaleSettings.deficit || 0
  const femaleTargetIntake = getIntakeTarget(femaleSettings)
  const femaleTargetProtein = femaleSettings.protein || 0
  const femaleTargetCarbs = femaleSettings.carbs || 0
  const femaleTargetFat = femaleSettings.fat || 0
  const femaleStartWeight = 65.0
  const femaleGoalWeight = 50.0

  // Dynamic values depending on active person / all view
  const currentPersonSettings = isFemale ? femaleSettings : maleSettings
  const MAINTENANCE_CALORIES = isAll ? (maleMaintenance + femaleMaintenance) : (isFemale ? femaleMaintenance : maleMaintenance)
  const DEFICIT_TARGET = isAll ? (maleDeficitTarget + femaleDeficitTarget) : (isFemale ? femaleDeficitTarget : maleDeficitTarget)
  const TARGET_CALORIES = isAll ? (maleTargetIntake + femaleTargetIntake) : (isFemale ? femaleTargetIntake : maleTargetIntake)
  const TARGET_PROTEIN = isAll ? (maleTargetProtein + femaleTargetProtein) : (isFemale ? femaleTargetProtein : maleTargetProtein)
  const TARGET_CARBS = isAll ? (maleTargetCarbs + femaleTargetCarbs) : (isFemale ? femaleTargetCarbs : maleTargetCarbs)
  const TARGET_FAT = isAll ? (maleTargetFat + femaleTargetFat) : (isFemale ? femaleTargetFat : maleTargetFat)
  const START_WEIGHT = isFemale ? femaleStartWeight : maleStartWeight
  const ULTIMATE_TARGET_WEIGHT = isFemale ? femaleGoalWeight : maleGoalWeight

  // Weight Loss Project & Deadline state
  const [projectModalOpen, setProjectModalOpen] = React.useState(false)
  const [stepGoalModalOpen, setStepGoalModalOpen] = React.useState(false)
  const [editProjectOpen, setEditProjectOpen] = React.useState(false)
  const [activeProject, setActiveProject] = React.useState<FitnessProject | null>(() =>
    getActiveProject(isFemale ? "ฝ่ายหญิง" : "ฝ่ายชาย")
  )

  React.useEffect(() => {
    setActiveProject(getActiveProject(isFemale ? "ฝ่ายหญิง" : "ฝ่ายชาย"))
  }, [isFemale, selectedPerson, meals, healthLogs])

  // 1. Interactive Fat Loss Goal (User can customize, default 10 kg)
  const storageKey = isFemale ? "finess_fatloss_target_female" : "finess_fatloss_target_male"
  const [targetFatLossKg, setTargetFatLossKg] = React.useState<number>(() => {
    const saved = localStorage.getItem(storageKey)
    return saved ? Number(saved) : (isFemale ? 5 : 10)
  })

  React.useEffect(() => {
    const saved = localStorage.getItem(storageKey)
    setTargetFatLossKg(saved ? Number(saved) : (isFemale ? 5 : 10))
  }, [isFemale, storageKey])

  const handleUpdateTargetKg = (kg: number) => {
    const valid = Math.max(1, Math.min(50, kg))
    setTargetFatLossKg(valid)
    localStorage.setItem(storageKey, String(valid))
  }

  // 1 kg of fat = 7,500 kcal deficit
  const totalDeficitTargetKcal = targetFatLossKg * 7500

  // Find latest weight logged from healthLogs
  const logsWithWeight = healthLogs.filter((log) => {
    const w = isFemale ? log.femaleWeight : log.maleWeight
    return w !== null && w !== undefined && w !== "" && !isNaN(Number(w))
  })
  const latestLog = logsWithWeight.length > 0 ? logsWithWeight[logsWithWeight.length - 1] : null
  const currentWeight = latestLog
    ? Number(isFemale ? latestLog.femaleWeight : latestLog.maleWeight)
    : START_WEIGHT

  // Actual weight lost
  const weightLostSoFar = Math.max(0, START_WEIGHT - currentWeight)

  // Calorie deficit calculation:
  const personMeals = meals.filter((m) => {
    const p = String(m.person || m.Person || "").trim()
    if (isAll) return true
    return p === selectedPerson || p === "ทั้งคู่"
  })

  // Date selection: Default to local today YYYY-MM-DD in user's timezone
  const todayStr = new Date().toLocaleDateString("en-CA")
  const [selectedDate, setSelectedDate] = React.useState<string>(todayStr)
  const activeDate = selectedDate || todayStr
  const isToday = activeDate === todayStr

  const handlePrevDay = () => {
    const cur = new Date(activeDate + "T12:00:00")
    cur.setDate(cur.getDate() - 1)
    setSelectedDate(cur.toLocaleDateString("en-CA"))
  }

  const handleNextDay = () => {
    const cur = new Date(activeDate + "T12:00:00")
    cur.setDate(cur.getDate() + 1)
    setSelectedDate(cur.toLocaleDateString("en-CA"))
  }

  const handleToday = () => {
    setSelectedDate(todayStr)
  }

  // Group meals by date to calculate daily intake deficits
  const dateIntakeMap: Record<string, number> = {}
  personMeals.forEach((m) => {
    const d = String(m.date || m.Date || "").split("T")[0]
    if (d) {
      dateIntakeMap[d] = (dateIntakeMap[d] || 0) + Number(m.calories || m.Calories || 0)
    }
  })

  let accumulatedIntakeDeficit = 0
  Object.values(dateIntakeMap).forEach((dailyIntake) => {
    const deficit = Math.max(0, MAINTENANCE_CALORIES - dailyIntake)
    accumulatedIntakeDeficit += deficit
  })

  // SEPARATE DEFICIT FROM WEIGHT:
  // 1. Deficit is purely from intake vs maintenance
  const accumulatedDeficitKcal = Math.max(0, accumulatedIntakeDeficit);
  const deficitProgressPercent = Math.min(100, Math.max(0, (accumulatedDeficitKcal / totalDeficitTargetKcal) * 100));
  const remainingDeficitKcal = Math.max(0, totalDeficitTargetKcal - accumulatedDeficitKcal);

  // 2. Weight progress is purely from weight lost in kg
  const weightProgressPercent = Math.min(100, Math.max(0, (weightLostSoFar / targetFatLossKg) * 100));
  const remainingFatKg = Math.max(0, Number((targetFatLossKg - weightLostSoFar).toFixed(1)));

  // Male Active Meals & Nutrients
  const maleMealsAll = meals.filter((m) => {
    const p = String(m.person || m.Person || "").trim()
    return p === "ฝ่ายชาย" || p === "ทั้งคู่"
  })
  const maleActiveMeals = maleMealsAll.filter((m) => String(m.date || m.Date || "").split("T")[0] === activeDate)
  const maleCalories = maleActiveMeals.reduce((s, m) => s + Number(m.calories || m.Calories || 0), 0)
  const maleProtein = maleActiveMeals.reduce((s, m) => s + Number(m.protein || m.Protein || 0), 0)
  const maleCarbs = maleActiveMeals.reduce((s, m) => s + Number(m.carbs || m.Carbs || 0), 0)
  const maleFat = maleActiveMeals.reduce((s, m) => s + Number(m.fat || m.Fat || 0), 0)
  const maleDeficitToday = maleMaintenance - maleCalories
  const maleIntakeDiff = maleTargetIntake - maleCalories

  // Female Active Meals & Nutrients
  const femaleMealsAll = meals.filter((m) => {
    const p = String(m.person || m.Person || "").trim()
    return p === "ฝ่ายหญิง" || p === "ทั้งคู่"
  })
  const femaleActiveMeals = femaleMealsAll.filter((m) => String(m.date || m.Date || "").split("T")[0] === activeDate)
  const femaleCalories = femaleActiveMeals.reduce((s, m) => s + Number(m.calories || m.Calories || 0), 0)
  const femaleProtein = femaleActiveMeals.reduce((s, m) => s + Number(m.protein || m.Protein || 0), 0)
  const femaleCarbs = femaleActiveMeals.reduce((s, m) => s + Number(m.carbs || m.Carbs || 0), 0)
  const femaleFat = femaleActiveMeals.reduce((s, m) => s + Number(m.fat || m.Fat || 0), 0)
  const femaleDeficitToday = femaleMaintenance - femaleCalories
  const femaleIntakeDiff = femaleTargetIntake - femaleCalories

  // Active Date Meals for display
  const activeDateMeals = isAll
    ? meals.filter((m) => String(m.date || m.Date || "").split("T")[0] === activeDate)
    : (isMale ? maleActiveMeals : femaleActiveMeals)

  const groupedActiveMeals = React.useMemo(
    () => groupMealsByFoodCategory(activeDateMeals),
    [activeDateMeals]
  )
  const foodGroupTargets = React.useMemo(
    () => getFoodGroupTargets(selectedPerson),
    [selectedPerson]
  )

  // Calculate totals for active date
  const totalCalories = isAll ? (maleCalories + femaleCalories) : (isMale ? maleCalories : femaleCalories)
  const totalProtein = isAll ? (maleProtein + femaleProtein) : (isMale ? maleProtein : femaleProtein)
  const totalCarbs = isAll ? (maleCarbs + femaleCarbs) : (isMale ? maleCarbs : femaleCarbs)
  const totalFat = isAll ? (maleFat + femaleFat) : (isMale ? maleFat : femaleFat)
  const calorieDiff = TARGET_CALORIES - totalCalories

  // Project analysis
  const projectAnalysis = activeProject
    ? analyzeProject(activeProject, meals, healthLogs, MAINTENANCE_CALORIES, TARGET_CALORIES)
    : null

  // 🏆 Adherence Scoring (Who is following the plan better?)
  const calculateScore = (
    cals: number,
    targetIntake: number,
    maintenance: number,
    targetDeficit: number,
    prot: number,
    targetProt: number,
    hasEntries: boolean
  ) => {
    if (!hasEntries || cals === 0) return 0
    let intakeScore = 40
    if (cals > targetIntake) {
      const overRatio = (cals - targetIntake) / targetIntake
      intakeScore = Math.max(0, 40 - overRatio * 100 * 1.5)
    }
    const def = maintenance - cals
    let defScore = 0
    if (def >= targetDeficit) {
      defScore = 40
    } else if (def > 0) {
      defScore = (def / targetDeficit) * 40
    }
    const protScore = Math.min(20, (prot / targetProt) * 20)
    return Math.round(intakeScore + defScore + protScore)
  }

  const maleScore = calculateScore(
    maleCalories,
    maleTargetIntake,
    maleMaintenance,
    maleDeficitTarget,
    maleProtein,
    maleTargetProtein,
    maleActiveMeals.length > 0
  )

  const femaleScore = calculateScore(
    femaleCalories,
    femaleTargetIntake,
    femaleMaintenance,
    femaleDeficitTarget,
    femaleProtein,
    femaleTargetProtein,
    femaleActiveMeals.length > 0
  )

  // Leader / Winner Evaluation
  let winner: "MALE" | "FEMALE" | "TIE" | "NONE" = "NONE"
  let winnerTitle = ""
  let winnerSubtitle = ""

  if (maleActiveMeals.length > 0 && femaleActiveMeals.length > 0) {
    if (Math.abs(maleScore - femaleScore) <= 2) {
      winner = "TIE"
      winnerTitle = "🤝 ทำตามแผนได้ยอดเยี่ยมเสมอกัน!"
      winnerSubtitle = "ทั้งคู่มีวินัยและควบคุมโภชนาการได้ใกล้เคียงเป้าหมายอย่างน่าชื่นชม"
    } else if (maleScore > femaleScore) {
      winner = "MALE"
      winnerTitle = "🏆 ฝ่ายชายทำตามแผนได้ดีกว่าวันนี้!"
      winnerSubtitle = `ฝ่ายชายทำคะแนนวินัยโภชนาการได้ ${maleScore} คะแนน (ฝ่ายหญิง ${femaleScore} คะแนน) คุมแคลอรี่และตัดทอนได้ตามเป้าหมายมากกว่า`
    } else {
      winner = "FEMALE"
      winnerTitle = "🏆 ฝ่ายหญิงทำตามแผนได้ดีกว่าวันนี้!"
      winnerSubtitle = `ฝ่ายหญิงทำคะแนนวินัยโภชนาการได้ ${femaleScore} คะแนน (ฝ่ายชาย ${maleScore} คะแนน) คุมแคลอรี่และตัดทอนได้ตามเป้าหมายมากกว่า`
    }
  } else if (maleActiveMeals.length > 0) {
    winner = "MALE"
    winnerTitle = "👑 ฝ่ายชายนำอยู่ในวันนี้!"
    winnerSubtitle = `ฝ่ายชายบันทึกอาหารแล้ว (${maleScore} คะแนน) รอฝ่ายหญิงบันทึกข้อมูลเพื่อสรุปผลเต็มรูปแบบ`
  } else if (femaleActiveMeals.length > 0) {
    winner = "FEMALE"
    winnerTitle = "👑 ฝ่ายหญิงนำอยู่ในวันนี้!"
    winnerSubtitle = `ฝ่ายหญิงบันทึกอาหารแล้ว (${femaleScore} คะแนน) รอฝ่ายชายบันทึกข้อมูลเพื่อสรุปผลเต็มรูปแบบ`
  } else {
    winner = "NONE"
    winnerTitle = "⏳ รอเริ่มบันทึกมื้ออาหารของวันนี้"
    winnerSubtitle = "เมื่อทั้งคู่เริ่มบันทึกมื้ออาหาร ระบบจะคำนวณคะแนนวินัยและประเมินผลการแข่งขันแบบ Real-Time!"
  }

  // Doughnut Chart Data (Macro Breakdown)
  const macroChartData = {
    labels: ["โปรตีน (g)", "คาร์โบไฮเดรต (g)", "ไขมัน (g)"],
    datasets: [
      {
        data: [
          totalProtein > 0 ? totalProtein : 1,
          totalCarbs > 0 ? totalCarbs : 1,
          totalFat > 0 ? totalFat : 1,
        ],
        backgroundColor: [
          "rgba(16, 185, 129, 0.85)", // Emerald
          "rgba(245, 158, 11, 0.85)", // Amber
          "rgba(244, 63, 94, 0.85)",  // Rose
        ],
        borderColor: ["#10b981", "#f59e0b", "#f43f5e"],
        borderWidth: 2,
      },
    ],
  }

  // Intake Bar Chart with Dynamic Timeframe Filter (7 / 14 / 30 days)
  const [chartDaysRange, setChartDaysRange] = React.useState<7 | 14 | 30>(30)
  const last7Days: string[] = []
  const last7DaysLabels: string[] = []
  for (let i = chartDaysRange - 1; i >= 0; i--) {
    const d = new Date()
    d.setDate(d.getDate() - i)
    const iso = d.toLocaleDateString("en-CA")
    last7Days.push(iso)
    last7DaysLabels.push(`${d.getDate()}/${d.getMonth() + 1}`)
  }

  const weeklyMaleCalories = last7Days.map((isoDate) => {
    return meals
      .filter((m) => (m.person === "ฝ่ายชาย" || m.person === "ทั้งคู่") && String(m.date || m.Date || "").split("T")[0] === isoDate)
      .reduce((sum, m) => sum + Number(m.calories || m.Calories || 0), 0)
  })

  const weeklyFemaleCalories = last7Days.map((isoDate) => {
    return meals
      .filter((m) => (m.person === "ฝ่ายหญิง" || m.person === "ทั้งคู่") && String(m.date || m.Date || "").split("T")[0] === isoDate)
      .reduce((sum, m) => sum + Number(m.calories || m.Calories || 0), 0)
  })

  // 30-Day Target Adherence %
  const active30DayValues = isAll
    ? weeklyMaleCalories.map((m, idx) => m + weeklyFemaleCalories[idx])
    : isMale
      ? weeklyMaleCalories
      : weeklyFemaleCalories
  const last30LoggedDays = active30DayValues.filter((cal) => cal > 0).length
  const last30OnTargetDays = active30DayValues.filter(
    (cal) => cal > 0 && TARGET_CALORIES > 0 && cal <= TARGET_CALORIES
  ).length
  const last30AdherencePct =
    last30LoggedDays > 0 ? Math.round((last30OnTargetDays / last30LoggedDays) * 100) : 0

  const getBarColors = (values: number[], targetKcal: number, maintenanceKcal: number) => {
    const bg: string[] = []
    const border: string[] = []
    values.forEach((cal) => {
      if (cal > maintenanceKcal && maintenanceKcal > 0) {
        bg.push("rgba(244, 63, 94, 0.82)") // Red: over maintenance (> 2300)
        border.push("#f43f5e")
      } else if (cal > targetKcal && targetKcal > 0) {
        bg.push("rgba(245, 158, 11, 0.85)") // Yellow: between target and maintenance (2001..2300)
        border.push("#f59e0b")
      } else {
        bg.push("rgba(16, 185, 129, 0.8)") // Green: <= target (<= 2000)
        border.push("#10b981")
      }
    })
    return { bg, border }
  }

  const singleWeeklyValues = isMale ? weeklyMaleCalories : weeklyFemaleCalories
  const singleBarColors = getBarColors(singleWeeklyValues, TARGET_CALORIES, MAINTENANCE_CALORIES)

  const weeklyBarData = isAll
    ? {
        labels: last7DaysLabels,
        datasets: [
          {
            label: "ฝ่ายชาย (kcal)",
            data: weeklyMaleCalories,
            backgroundColor: "rgba(16, 185, 129, 0.75)",
            borderColor: "#10b981",
            borderRadius: 6,
          },
          {
            label: "ฝ่ายหญิง (kcal)",
            data: weeklyFemaleCalories,
            backgroundColor: "rgba(236, 72, 153, 0.75)",
            borderColor: "#ec4899",
            borderRadius: 6,
          },
        ],
      }
    : {
        labels: last7DaysLabels,
        datasets: [
          {
            label: "แคลอรี่ (kcal)",
            data: singleWeeklyValues,
            backgroundColor: singleBarColors.bg,
            borderColor: singleBarColors.border,
            borderWidth: 1,
            borderRadius: 6,
          },
        ],
      }

  const targetLinePlugin = React.useMemo(
    () => ({
      id: "targetCalorieLine",
      afterDatasetsDraw(chart: any) {
        if (isAll || !TARGET_CALORIES || TARGET_CALORIES <= 0) return
        const { ctx, chartArea, scales } = chart
        if (!chartArea || !scales?.y) return
        const yPos = scales.y.getPixelForValue(TARGET_CALORIES)
        if (yPos < chartArea.top || yPos > chartArea.bottom) return

        ctx.save()
        ctx.beginPath()
        ctx.setLineDash([6, 4])
        ctx.lineWidth = 2
        ctx.strokeStyle = "#38bdf8" // Sky blue dashed target line
        ctx.moveTo(chartArea.left, yPos)
        ctx.lineTo(chartArea.right, yPos)
        ctx.stroke()

        // Label on right side of line
        const labelText = `เป้า ${TARGET_CALORIES.toLocaleString()} kcal`
        ctx.font = "600 11px sans-serif"
        const textWidth = ctx.measureText(labelText).width
        const padX = 6
        const boxW = textWidth + padX * 2
        const boxH = 18
        const boxX = chartArea.right - boxW - 4
        const boxY = Math.max(chartArea.top + 2, yPos - boxH - 4)

        ctx.setLineDash([])
        ctx.fillStyle = "rgba(15, 23, 42, 0.88)"
        ctx.strokeStyle = "rgba(56, 189, 248, 0.6)"
        ctx.lineWidth = 1
        ctx.beginPath()
        ctx.roundRect(boxX, boxY, boxW, boxH, 4)
        ctx.fill()
        ctx.stroke()

        ctx.fillStyle = "#7dd3fc"
        ctx.textAlign = "center"
        ctx.textBaseline = "middle"
        ctx.fillText(labelText, boxX + boxW / 2, boxY + boxH / 2)
        ctx.restore()
      },
    }),
    [isAll, TARGET_CALORIES]
  )

  // Sleep Trend Bar Chart (7 / 14 / 30 days) styled identically to Calorie Trend Bar Chart
  const [sleepDaysRange, setSleepDaysRange] = React.useState<7 | 14 | 30>(30)
  const allSleepLogsForChart = getSleepLogs()
  const activeSleepGoal = isFemale
    ? getSleepGoal("ฝ่ายหญิง") || 8
    : getSleepGoal("ฝ่ายชาย") || 8

  const sleepChartDates: string[] = []
  const sleepChartLabels: string[] = []
  for (let i = sleepDaysRange - 1; i >= 0; i--) {
    const d = new Date()
    d.setDate(d.getDate() - i)
    const iso = d.toLocaleDateString("en-CA")
    sleepChartDates.push(iso)
    sleepChartLabels.push(`${d.getDate()}/${d.getMonth() + 1}`)
  }

  const sleepMaleEntriesByDate = sleepChartDates.map((isoDate) =>
    allSleepLogsForChart.find((s) => s.person === "ฝ่ายชาย" && s.date === isoDate)
  )
  const sleepFemaleEntriesByDate = sleepChartDates.map((isoDate) =>
    allSleepLogsForChart.find((s) => s.person === "ฝ่ายหญิง" && s.date === isoDate)
  )

  const weeklyMaleSleepHours = sleepMaleEntriesByDate.map((entry) =>
    entry ? Number(entry.durationHours || 0) : 0
  )
  const weeklyFemaleSleepHours = sleepFemaleEntriesByDate.map((entry) =>
    entry ? Number(entry.durationHours || 0) : 0
  )

  const activeSleepSeries = isAll
    ? weeklyMaleSleepHours.map((m, idx) => {
        const f = weeklyFemaleSleepHours[idx]
        if (m > 0 && f > 0) return Number(((m + f) / 2).toFixed(1))
        return m > 0 ? m : f
      })
    : isMale
    ? weeklyMaleSleepHours
    : weeklyFemaleSleepHours

  const sleepLoggedValues = activeSleepSeries.filter((h) => h > 0)
  const lastSleepLoggedDays = sleepLoggedValues.length
  const lastSleepOnTargetDays = sleepLoggedValues.filter(
    (h) => h >= activeSleepGoal
  ).length
  const lastSleepAdherencePct =
    lastSleepLoggedDays > 0
      ? Math.round((lastSleepOnTargetDays / lastSleepLoggedDays) * 100)
      : 0
  const avgSleepHoursInRange =
    lastSleepLoggedDays > 0
      ? Number(
          (
            sleepLoggedValues.reduce((sum, h) => sum + h, 0) /
            lastSleepLoggedDays
          ).toFixed(1)
        )
      : 0

  const getSleepBarColors = (values: number[], goalHours: number) => {
    const bg: string[] = []
    const border: string[] = []
    values.forEach((h) => {
      if (h >= goalHours) {
        bg.push("rgba(16, 185, 129, 0.82)") // Green: met sleep goal (>= 8h)
        border.push("#10b981")
      } else if (h >= 6) {
        bg.push("rgba(245, 158, 11, 0.85)") // Yellow: moderate sleep (6.0 - 7.9h)
        border.push("#f59e0b")
      } else {
        bg.push("rgba(244, 63, 94, 0.82)") // Red: short sleep (< 6h)
        border.push("#f43f5e")
      }
    })
    return { bg, border }
  }

  const singleSleepValues = isMale ? weeklyMaleSleepHours : weeklyFemaleSleepHours
  const singleSleepBarColors = getSleepBarColors(singleSleepValues, activeSleepGoal)

  const sleepBarData = isAll
    ? {
        labels: sleepChartLabels,
        datasets: [
          {
            label: "ฝ่ายชาย (ชม.)",
            data: weeklyMaleSleepHours,
            backgroundColor: "rgba(16, 185, 129, 0.75)",
            borderColor: "#10b981",
            borderRadius: 6,
          },
          {
            label: "ฝ่ายหญิง (ชม.)",
            data: weeklyFemaleSleepHours,
            backgroundColor: "rgba(236, 72, 153, 0.75)",
            borderColor: "#ec4899",
            borderRadius: 6,
          },
        ],
      }
    : {
        labels: sleepChartLabels,
        datasets: [
          {
            label: "เวลานอน (ชม.)",
            data: singleSleepValues,
            backgroundColor: singleSleepBarColors.bg,
            borderColor: singleSleepBarColors.border,
            borderWidth: 1,
            borderRadius: 6,
          },
        ],
      }

  const sleepTargetLinePlugin = React.useMemo(
    () => ({
      id: "targetSleepLine",
      afterDatasetsDraw(chart: any) {
        if (!activeSleepGoal || activeSleepGoal <= 0) return
        const { ctx, chartArea, scales } = chart
        if (!chartArea || !scales?.y) return
        const yPos = scales.y.getPixelForValue(activeSleepGoal)
        if (yPos < chartArea.top || yPos > chartArea.bottom) return

        ctx.save()
        ctx.beginPath()
        ctx.setLineDash([6, 4])
        ctx.lineWidth = 2
        ctx.strokeStyle = "#38bdf8" // Sky blue dashed target line
        ctx.moveTo(chartArea.left, yPos)
        ctx.lineTo(chartArea.right, yPos)
        ctx.stroke()

        // Label on right side of line
        const labelText = `เป้า ${activeSleepGoal} ชม.`
        ctx.font = "600 11px sans-serif"
        const textWidth = ctx.measureText(labelText).width
        const padX = 6
        const boxW = textWidth + padX * 2
        const boxH = 18
        const boxX = chartArea.right - boxW - 4
        const boxY = Math.max(chartArea.top + 2, yPos - boxH - 4)

        ctx.setLineDash([])
        ctx.fillStyle = "rgba(15, 23, 42, 0.88)"
        ctx.strokeStyle = "rgba(56, 189, 248, 0.6)"
        ctx.lineWidth = 1
        ctx.beginPath()
        ctx.roundRect(boxX, boxY, boxW, boxH, 4)
        ctx.fill()
        ctx.stroke()

        ctx.fillStyle = "#7dd3fc"
        ctx.textAlign = "center"
        ctx.textBaseline = "middle"
        ctx.fillText(labelText, boxX + boxW / 2, boxY + boxH / 2)
        ctx.restore()
      },
    }),
    [activeSleepGoal]
  )

  return (
    <div className="space-y-6">
      {/* Top Banner & Action Buttons */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-gradient-to-r from-slate-900 via-[#151d2f] to-[#151d2f] border border-[#26334d] rounded-2xl p-6 shadow-lg">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-2xl">{isAll ? "👥" : isMale ? "🏋️‍♂️" : "🧘‍♀️"}</span>
            <h1 className="text-2xl font-bold text-white tracking-tight">
              โภชนาการและแผนสุขภาพ:{" "}
              <span className={isAll ? "text-indigo-400" : isMale ? "text-emerald-400" : "text-pink-400"}>
                {isAll ? "ภาพรวมคู่รัก (เปรียบเทียบ ชาย vs หญิง)" : selectedPerson}
              </span>
            </h1>
          </div>
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-300 mt-1">
            {isAll ? (
              <>
                <span>🔥 เผาผลาญรวม: <strong className="text-white font-mono">{MAINTENANCE_CALORIES.toLocaleString()}</strong> kcal</span>
                <span>•</span>
                <span>🎯 ตัดทอนรวม: <strong className="text-amber-300 font-mono">-{DEFICIT_TARGET.toLocaleString()}</strong> kcal</span>
                <span>•</span>
                <span className="bg-indigo-500/20 text-indigo-300 px-2.5 py-0.5 rounded-md font-semibold border border-indigo-500/30">
                  🍽️ ควรกินรวมไม่เกิน: <span className="font-mono">{TARGET_CALORIES.toLocaleString()}</span> kcal/วัน (ชาย {maleTargetIntake} + หญิง {femaleTargetIntake})
                </span>
              </>
            ) : (
              <>
                <span>🔥 เผาผลาญ: <strong className="text-white font-mono">{MAINTENANCE_CALORIES.toLocaleString()}</strong> kcal</span>
                <span>•</span>
                <span>🎯 ตัดทอน: <strong className="text-amber-300 font-mono">-{DEFICIT_TARGET.toLocaleString()}</strong> kcal</span>
                <span>•</span>
                <span className="bg-emerald-500/20 text-emerald-300 px-2.5 py-0.5 rounded-md font-semibold border border-emerald-500/30">
                  🍽️ ควรกินไม่เกิน: <span className="font-mono">{TARGET_CALORIES.toLocaleString()}</span> kcal/วัน
                </span>
              </>
            )}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Settings Button */}
          <Button
            onClick={() => setCalorieModalOpen(true)}
            variant="outline"
            className="border-[#26334d] bg-[#0b0f19] text-slate-300 hover:text-white hover:bg-slate-800 text-xs font-medium flex items-center gap-1.5 h-9 px-3"
            title="ตั้งค่าเป้าหมายสุขภาพ: TDEE, แคลอรี่, สัดส่วนสารอาหาร และก้าวเดิน"
          >
            <Sliders className="h-3.5 w-3.5 text-slate-400" />
            ตั้งค่าเป้าหมาย
          </Button>

          {/* Toggle Couple View */}
          <div className="flex items-center gap-1.5 bg-[#0b0f19] p-1 rounded-xl border border-[#26334d]">
            <button
              onClick={() => onSelectPerson("ฝ่ายชาย")}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all ${
                selectedPerson === "ฝ่ายชาย"
                  ? "bg-emerald-600 text-white shadow-md shadow-emerald-950"
                  : "text-slate-400 hover:text-white"
              }`}
            >
              <span>🏋️‍♂️</span> ฝ่ายชาย
            </button>
            <button
              onClick={() => onSelectPerson("ฝ่ายหญิง")}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all ${
                selectedPerson === "ฝ่ายหญิง"
                  ? "bg-pink-600 text-white shadow-md shadow-pink-950"
                  : "text-slate-400 hover:text-white"
              }`}
            >
              <span>🧘‍♀️</span> ฝ่ายหญิง
            </button>
            <button
              onClick={() => onSelectPerson("ALL")}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all ${
                isAll
                  ? "bg-indigo-600 text-white shadow-md shadow-indigo-950"
                  : "text-slate-400 hover:text-white"
              }`}
            >
              <span>👥</span> รวม (เปรียบเทียบ)
            </button>
          </div>

          {/* Action Buttons: Add Weight, Add Step & Add Meal */}
          <Button
            onClick={onOpenAddWeight}
            className="bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-medium flex items-center gap-1.5 h-9 px-3 shadow-md shadow-indigo-950"
          >
            <Scale className="h-4 w-4" />
            + บันทึกน้ำหนัก
          </Button>

          {onOpenAddStep && (
            <Button
              onClick={onOpenAddStep}
              className="bg-purple-600 hover:bg-purple-500 text-white text-xs font-medium flex items-center gap-1.5 h-9 px-3 shadow-md shadow-purple-950"
            >
              <Footprints className="h-4 w-4" />
              + บันทึกก้าวเดิน
            </Button>
          )}

          {onOpenAddSleep && (
            <Button
              onClick={() =>
                onOpenAddSleep(
                  activeDate,
                  selectedPerson === "ALL" ? "ฝ่ายชาย" : selectedPerson
                )
              }
              className="bg-sky-600 hover:bg-sky-500 text-white text-xs font-medium flex items-center gap-1.5 h-9 px-3 shadow-md shadow-sky-950"
            >
              <Moon className="h-4 w-4" />
              + บันทึกเวลานอน
            </Button>
          )}

          <Button
            onClick={() => onOpenAddMeal(activeDate)}
            className="bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-medium flex items-center gap-1.5 h-9 px-3 shadow-md shadow-emerald-950"
          >
            <Plus className="h-4 w-4" />
            + เพิ่มมื้ออาหาร
          </Button>
        </div>
      </div>

      {/* 📅 Date Navigator Bar: ค่าเริ่มต้นคือ "วันนี้" เสมอ พร้อมปุ่มเลื่อนวันและดูย้อนหลัง */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-[#111726] border border-[#26334d] p-3 rounded-2xl shadow-lg">
        <div className="flex items-center gap-2 flex-wrap">
          <Button
            variant="outline"
            size="sm"
            onClick={handlePrevDay}
            className="border-[#26334d] bg-[#0b0f19] text-slate-300 hover:text-white hover:bg-slate-800 h-8 px-2.5"
            title="ดูวันก่อนหน้า"
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>

          <div className="px-3.5 py-1.5 bg-[#0b0f19] border border-[#26334d] rounded-xl text-sm font-bold text-white font-mono flex items-center gap-2">
            <Calendar className="h-4 w-4 text-emerald-400" />
            <span>{formatThaiDate(activeDate)}</span>
            {isToday ? (
              <Badge className="bg-emerald-500/20 text-emerald-300 border-emerald-500/30 text-[10px] px-2 py-0.5">
                🌟 วันนี้
              </Badge>
            ) : (
              <Badge className="bg-amber-500/20 text-amber-300 border-amber-500/30 text-[10px] px-2 py-0.5">
                📅 ดูย้อนหลัง
              </Badge>
            )}
          </div>

          <Button
            variant="outline"
            size="sm"
            onClick={handleNextDay}
            className="border-[#26334d] bg-[#0b0f19] text-slate-300 hover:text-white hover:bg-slate-800 h-8 px-2.5"
            title="ดูวันถัดไป"
          >
            <ChevronRight className="h-4 w-4" />
          </Button>

          {!isToday && (
            <Button
              variant="ghost"
              size="sm"
              onClick={handleToday}
              className="text-xs text-emerald-400 hover:text-white hover:bg-emerald-900/30 h-8 px-2.5 font-bold flex items-center gap-1"
            >
              <span>กลับมาวันนี้</span>
            </Button>
          )}
        </div>

        {/* Date Picker Input */}
        <div className="flex items-center gap-2 text-xs text-slate-300 bg-[#0b0f19] px-3 py-1 rounded-xl border border-[#26334d]">
          <span className="text-[11px] text-slate-400">เลือกวันที่:</span>
          <Input
            type="date"
            value={activeDate}
            onChange={(e) => setSelectedDate(e.target.value)}
            className="bg-transparent border-none text-white text-xs h-7 w-32 p-0 focus:ring-0 font-mono"
          />
        </div>
      </div>

      {/* ⚡ HOLISTIC 4-PILLAR ROUTINE & ENERGY BALANCE CARD (ภาพรวมรูทีนลดน้ำหนัก & พลังงานรายวัน) */}
      {(() => {
        const allSteps = getDailyStepLogs()
        const allSleep = getSleepLogs()
        const targetPersonKey = isFemale ? "ฝ่ายหญิง" : "ฝ่ายชาย"

        // Step stats for activeDate
        const maleStepEntry = allSteps.find((s) => s.date === activeDate && s.person === "ฝ่ายชาย")
        const femaleStepEntry = allSteps.find((s) => s.date === activeDate && s.person === "ฝ่ายหญิง")
        const activeSteps = isAll
          ? (maleStepEntry?.steps || 0) + (femaleStepEntry?.steps || 0)
          : isFemale
          ? femaleStepEntry?.steps || 0
          : maleStepEntry?.steps || 0
        const activeStepGoal = isAll
          ? (maleSettings.stepGoal || 8000) + (femaleSettings.stepGoal || 8000)
          : isFemale
          ? femaleSettings.stepGoal || 8000
          : maleSettings.stepGoal || 8000
        const stepPct = Math.min(100, Math.round((activeSteps / Math.max(1, activeStepGoal)) * 100))

        // Sleep stats for activeDate
        const maleSleepEntry = allSleep.find((s) => s.date === activeDate && s.person === "ฝ่ายชาย")
        const femaleSleepEntry = allSleep.find((s) => s.date === activeDate && s.person === "ฝ่ายหญิง")
        const singleSleepEntry = isFemale ? femaleSleepEntry : maleSleepEntry
        const singleSleepGoal = getSleepGoal(targetPersonKey)
        const sleepEval = singleSleepEntry
          ? evaluateSleepStatus(
              singleSleepEntry.durationHours,
              singleSleepEntry.sleepGoalHours || singleSleepGoal,
              singleSleepEntry.bedTime,
              singleSleepEntry.quality
            )
          : null

        // Calculate 4-Pillar Routine & Energy Score (0-100)
        // 1. Sleep (25 pts)
        let sleepPillarScore = 0
        if (isAll) {
          const mEv = maleSleepEntry
            ? evaluateSleepStatus(maleSleepEntry.durationHours, maleSleepEntry.sleepGoalHours || 8, maleSleepEntry.bedTime, maleSleepEntry.quality).energyScore
            : 0
          const fEv = femaleSleepEntry
            ? evaluateSleepStatus(femaleSleepEntry.durationHours, femaleSleepEntry.sleepGoalHours || 8, femaleSleepEntry.bedTime, femaleSleepEntry.quality).energyScore
            : 0
          sleepPillarScore = Math.round(((mEv + fEv) / 200) * 25)
        } else if (sleepEval) {
          sleepPillarScore = Math.round((sleepEval.energyScore / 100) * 25)
        }

        // 2. Calorie Control (30 pts)
        let calPillarScore = 0
        if (totalCalories > 0) {
          if (totalCalories <= TARGET_CALORIES) calPillarScore = 30
          else if (totalCalories <= MAINTENANCE_CALORIES) calPillarScore = 18
          else calPillarScore = 5
        }

        // 3. Protein Target (25 pts)
        const proteinPct = Math.min(100, Math.round((totalProtein / Math.max(1, TARGET_PROTEIN)) * 100))
        const protPillarScore = Math.round((proteinPct / 100) * 25)

        // 4. Movement / Steps (20 pts)
        const stepPillarScore = Math.round((stepPct / 100) * 20)

        const totalRoutineScore = sleepPillarScore + calPillarScore + protPillarScore + stepPillarScore

        // Actionable Coaching Advice for Today's Routine
        const tips: string[] = []
        if (!singleSleepEntry && !isAll) {
          tips.push("🌙 จดเวลานอนเมื่อคืนเพื่อประเมินระดับฮอร์โมนและพลังงานวันนี้")
        } else if (singleSleepEntry && isLateBedtime(singleSleepEntry.bedTime, 23, 30)) {
          tips.push(`🌙 เมื่อคืนเข้านอนดึก (${singleSleepEntry.bedTime} น.) คืนนี้แนะนำตั้งเป้าเข้านอนก่อน 23:00 น. เพื่อกระตุ้น Growth Hormone`)
        } else if (singleSleepEntry && singleSleepEntry.durationHours < 7) {
          tips.push(`🪫 เมื่อคืนนอนเพียง ${singleSleepEntry.durationHours} ชม. วันนี้ควรดื่มน้ำเพิ่มและเน้นโปรตีนเพื่อลดอาการหิวของหวาน`)
        }
        if (totalProtein < TARGET_PROTEIN) {
          tips.push(`🥩 เติมโปรตีนอีก ${(TARGET_PROTEIN - totalProtein).toFixed(0)} กรัม เพื่อรักษากล้ามเนื้อและทำให้อิ่มนานขึ้น`)
        }
        if (activeSteps < activeStepGoal) {
          tips.push(`👟 เดินเพิ่มอีก ${(activeStepGoal - activeSteps).toLocaleString()} ก้าว (เช่น เดินย่อยหลังอาหาร 15-20 นาที) เพื่อเร่งเผาผลาญไขมัน`)
        }
        if (totalCalories > TARGET_CALORIES) {
          tips.push(`⚠️ วันนี้แคลอรี่เกินเป้าตัดทอนไป ${Math.abs(calorieDiff).toLocaleString()} kcal แนะนำเดินเพิ่มหรือคุมมื้อถัดไปให้คลีน`)
        }
        if (tips.length === 0) {
          tips.push("🌟 รูทีนทั้ง 4 เสาหลักของวันนี้สมบูรณ์แบบมาก! ทั้งการนอน โภชนาการ โปรตีน และการขยับตัวอยู่ในจุดที่เผาผลาญไขมันได้ดีที่สุด")
        }

        return (
          <Card className="bg-gradient-to-br from-[#101829] via-[#131d31] to-[#171c34] border border-sky-500/40 shadow-xl overflow-hidden">
            <CardHeader className="p-4 pb-3 border-b border-[#26334d] flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div>
                <CardTitle className="text-base font-bold text-white flex items-center gap-2 flex-wrap">
                  <Zap className="h-5 w-5 text-amber-400" />
                  <span>เช็กลิสต์รูทีน 4 เสาหลักเพื่อลดน้ำหนัก & พลังงานที่ดี</span>
                  <Badge className="bg-sky-500/20 text-sky-300 border-sky-500/30 text-[11px]">
                    {isToday ? "รูทีนวันนี้" : formatThaiDate(activeDate)}
                  </Badge>
                </CardTitle>
                <CardDescription className="text-xs text-slate-400">
                  ประเมินความสมดุลระหว่าง การนอนหลับ • แคลอรี่ • โปรตีน • การขยับตัว ({isAll ? "รวมคู่รัก" : selectedPerson})
                </CardDescription>
              </div>

              <div className="flex items-center gap-3 bg-[#0b0f19] px-3.5 py-2 rounded-xl border border-[#26334d]">
                <div>
                  <span className="text-[10px] text-slate-400 block">คะแนนรูทีน & พลังงาน</span>
                  <span className="text-lg font-extrabold text-emerald-400 font-mono">
                    {totalRoutineScore} <span className="text-xs font-normal text-slate-400">/ 100</span>
                  </span>
                </div>
                <Badge
                  className={`text-[11px] font-semibold ${
                    totalRoutineScore >= 80
                      ? "bg-emerald-500/20 text-emerald-300 border-emerald-500/30"
                      : totalRoutineScore >= 55
                      ? "bg-amber-500/20 text-amber-300 border-amber-500/30"
                      : "bg-slate-800 text-slate-300 border-slate-700"
                  }`}
                >
                  {totalRoutineScore >= 80
                    ? "⚡ รูทีนยอดเยี่ยม"
                    : totalRoutineScore >= 55
                    ? "🔋 กำลังสะสมรูทีน"
                    : "🌱 เริ่มต้นรูทีนวันนี้"}
                </Badge>
              </div>
            </CardHeader>

            <CardContent className="p-4 space-y-3.5">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-xs">
                {/* Pillar 1: Sleep & Energy */}
                <div className="p-3 rounded-xl bg-[#0b0f19] border border-sky-500/30 space-y-2 flex flex-col justify-between">
                  <div>
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-sky-300 flex items-center gap-1.5">
                        <Moon className="h-3.5 w-3.5 text-sky-400" />
                        1. การนอน & ฟื้นฟู
                      </span>
                      <span className="text-[10px] font-mono text-sky-400 font-bold">
                        {sleepPillarScore}/25 คะแนน
                      </span>
                    </div>
                    <div className="mt-1.5">
                      {isAll ? (
                        <div className="text-xs text-white font-mono space-y-0.5">
                          <div>
                            🏋️‍♂️ ชาย:{" "}
                            {maleSleepEntry
                              ? `${maleSleepEntry.bedTime}-${maleSleepEntry.wakeTime} (${maleSleepEntry.durationHours}ชม.)`
                              : "ยังไม่จด"}
                          </div>
                          <div>
                            🧘‍♀️ หญิง:{" "}
                            {femaleSleepEntry
                              ? `${femaleSleepEntry.bedTime}-${femaleSleepEntry.wakeTime} (${femaleSleepEntry.durationHours}ชม.)`
                              : "ยังไม่จด"}
                          </div>
                        </div>
                      ) : singleSleepEntry ? (
                        <div>
                          <div className="text-sm font-extrabold text-white font-mono">
                            {calculateSleepDuration(singleSleepEntry.bedTime, singleSleepEntry.wakeTime).formatted}
                          </div>
                          <span className="text-[11px] text-slate-400 font-mono">
                            🌙 {singleSleepEntry.bedTime} ➔ ☀️ {singleSleepEntry.wakeTime} น.
                          </span>
                        </div>
                      ) : (
                        <div className="text-xs text-slate-500 py-1">ยังไม่ได้บันทึกเวลานอนวันนี้</div>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center justify-between pt-1 border-t border-[#26334d]/60">
                    <span className="text-[10px] text-slate-400">
                      {sleepEval ? sleepEval.label : "เป้า 7.5 - 8 ชม."}
                    </span>
                    {onOpenAddSleep && (
                      <button
                        type="button"
                        onClick={() => onOpenAddSleep(activeDate, targetPersonKey)}
                        className="text-[10px] text-sky-300 hover:text-white bg-sky-500/15 hover:bg-sky-600 px-2 py-0.5 rounded border border-sky-500/30 transition-all"
                      >
                        {singleSleepEntry ? "แก้ไขเวลา" : "+ จดเวลานอน"}
                      </button>
                    )}
                  </div>
                </div>

                {/* Pillar 2: Calorie Deficit */}
                <div className="p-3 rounded-xl bg-[#0b0f19] border border-emerald-500/30 space-y-2 flex flex-col justify-between">
                  <div>
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-emerald-300 flex items-center gap-1.5">
                        <Flame className="h-3.5 w-3.5 text-emerald-400" />
                        2. คุมแคลอรี่ลดไขมัน
                      </span>
                      <span className="text-[10px] font-mono text-emerald-400 font-bold">
                        {calPillarScore}/30 คะแนน
                      </span>
                    </div>
                    <div className="mt-1.5">
                      <div className="text-sm font-extrabold text-white font-mono">
                        {totalCalories.toLocaleString()}{" "}
                        <span className="text-[11px] font-normal text-slate-400">
                          / {TARGET_CALORIES.toLocaleString()} kcal
                        </span>
                      </div>
                      <span
                        className={`text-[11px] font-mono ${
                          calorieDiff >= 0 ? "text-emerald-400" : "text-rose-400"
                        }`}
                      >
                        {calorieDiff >= 0
                          ? `เหลือโควต้า ${calorieDiff.toLocaleString()} kcal`
                          : `เกินโควต้า +${Math.abs(calorieDiff).toLocaleString()} kcal`}
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center justify-between pt-1 border-t border-[#26334d]/60">
                    <span className="text-[10px] text-slate-400">
                      ตัดทอนวันนี้:{" "}
                      {MAINTENANCE_CALORIES - totalCalories >= 0
                        ? `-${(MAINTENANCE_CALORIES - totalCalories).toLocaleString()} kcal`
                        : "เกินเมนเทน"}
                    </span>
                    <button
                      type="button"
                      onClick={() => onOpenAddMeal(activeDate)}
                      className="text-[10px] text-emerald-300 hover:text-white bg-emerald-500/15 hover:bg-emerald-600 px-2 py-0.5 rounded border border-emerald-500/30 transition-all"
                    >
                      + จดมื้ออาหาร
                    </button>
                  </div>
                </div>

                {/* Pillar 3: Protein Satiety */}
                <div className="p-3 rounded-xl bg-[#0b0f19] border border-amber-500/30 space-y-2 flex flex-col justify-between">
                  <div>
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-amber-300 flex items-center gap-1.5">
                        <Beef className="h-3.5 w-3.5 text-amber-400" />
                        3. โปรตีน & อิ่มนาน
                      </span>
                      <span className="text-[10px] font-mono text-amber-400 font-bold">
                        {protPillarScore}/25 คะแนน
                      </span>
                    </div>
                    <div className="mt-1.5">
                      <div className="text-sm font-extrabold text-white font-mono">
                        {totalProtein.toFixed(1)}g{" "}
                        <span className="text-[11px] font-normal text-slate-400">
                          / {TARGET_PROTEIN}g ({proteinPct}%)
                        </span>
                      </div>
                      <div className="w-full bg-slate-800 rounded-full h-1.5 mt-1.5 overflow-hidden">
                        <div
                          className="bg-amber-400 h-1.5 rounded-full transition-all"
                          style={{ width: `${proteinPct}%` }}
                        />
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center justify-between pt-1 border-t border-[#26334d]/60 text-[10px] text-slate-400">
                    <span>
                      {totalProtein >= TARGET_PROTEIN
                        ? "✅ โปรตีนครบเป้าแล้ว"
                        : `ขาดอีก ${(TARGET_PROTEIN - totalProtein).toFixed(0)}g`}
                    </span>
                    <span>รักษามวลกล้ามเนื้อ</span>
                  </div>
                </div>

                {/* Pillar 4: Daily Steps & NEAT */}
                <div className="p-3 rounded-xl bg-[#0b0f19] border border-indigo-500/30 space-y-2 flex flex-col justify-between">
                  <div>
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-indigo-300 flex items-center gap-1.5">
                        <Footprints className="h-3.5 w-3.5 text-indigo-400" />
                        4. ก้าวเดิน & ขยับตัว
                      </span>
                      <span className="text-[10px] font-mono text-indigo-400 font-bold">
                        {stepPillarScore}/20 คะแนน
                      </span>
                    </div>
                    <div className="mt-1.5">
                      <div className="text-sm font-extrabold text-white font-mono">
                        {activeSteps.toLocaleString()}{" "}
                        <span className="text-[11px] font-normal text-slate-400">
                          / {activeStepGoal.toLocaleString()} ก้าว ({stepPct}%)
                        </span>
                      </div>
                      <div className="w-full bg-slate-800 rounded-full h-1.5 mt-1.5 overflow-hidden">
                        <div
                          className="bg-indigo-400 h-1.5 rounded-full transition-all"
                          style={{ width: `${stepPct}%` }}
                        />
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center justify-between pt-1 border-t border-[#26334d]/60">
                    <span className="text-[10px] text-slate-400">
                      เผาผลาญ ~{Math.round(activeSteps * 0.035)} kcal
                    </span>
                    {onOpenAddStep && (
                      <button
                        type="button"
                        onClick={onOpenAddStep}
                        className="text-[10px] text-indigo-300 hover:text-white bg-indigo-500/15 hover:bg-indigo-600 px-2 py-0.5 rounded border border-indigo-500/30 transition-all"
                      >
                        + กรอกก้าว
                      </button>
                    )}
                  </div>
                </div>
              </div>

              {/* Actionable Daily Routine Advice */}
              <div className="p-3 rounded-xl bg-[#0b0f19]/90 border border-indigo-500/30 flex items-start gap-2.5 text-xs">
                <Lightbulb className="h-4 w-4 text-amber-400 shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <strong className="text-white block">
                    คำแนะนำปรับรูทีนประจำวันเพื่อให้ลดน้ำหนักได้ดีและมีพลังงานสดชื่น:
                  </strong>
                  <ul className="space-y-0.5 text-slate-300">
                    {tips.map((tip, i) => (
                      <li key={i}>{tip}</li>
                    ))}
                  </ul>
                </div>
              </div>
            </CardContent>
          </Card>
        )
      })()}

      {/* 🏆 FEATURE: COUPLE ADHERENCE COMPARISON CARD (WHO IS DOING BETTER?) */}
      {isAll && (
        <Card className="bg-gradient-to-br from-[#131b2e] via-[#161d31] to-[#1c1836] border-2 border-indigo-500/40 shadow-2xl overflow-hidden">
          <CardHeader className="border-b border-[#26334d] pb-4 bg-[#0d1424]/80">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <CardTitle className="text-lg font-bold text-white flex items-center gap-2">
                  <Trophy className="h-6 w-6 text-amber-400 animate-pulse" />
                  สรุปผลการแข่งขันวินัยตามแผน: ใครทำตามแผนได้ดีกว่ากัน?
                </CardTitle>
                <CardDescription className="text-xs text-slate-300 mt-0.5">
                  เปรียบเทียบความมีวินัยในการควบคุมแคลอรี่ไม่เกินโควต้า การตัดทอนแคลอรี่ตามเป้า และสารอาหารโปรตีน
                </CardDescription>
              </div>

              {/* Winner Highlight Badge */}
              <div className="flex items-center gap-2">
                <Badge
                  className={`text-xs px-3 py-1 font-semibold border shadow-md flex items-center gap-1.5 ${
                    winner === "MALE"
                      ? "bg-emerald-500/20 text-emerald-300 border-emerald-500/40"
                      : winner === "FEMALE"
                      ? "bg-pink-500/20 text-pink-300 border-pink-500/40"
                      : winner === "TIE"
                      ? "bg-indigo-500/20 text-indigo-300 border-indigo-500/40"
                      : "bg-slate-800 text-slate-400 border-slate-700"
                  }`}
                >
                  <Crown className="h-3.5 w-3.5 text-amber-400" />
                  {winnerTitle}
                </Badge>
              </div>
            </div>

            <p className="text-xs text-slate-400 pt-1">
              {winnerSubtitle}
            </p>
          </CardHeader>

          <CardContent className="p-6 space-y-5">
            {/* Side-by-Side Comparison Columns */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Male Column */}
              <div className={`p-4 rounded-2xl border transition-all ${
                winner === "MALE"
                  ? "bg-emerald-950/20 border-emerald-500/50 shadow-lg shadow-emerald-950/30"
                  : "bg-[#0b0f19] border-[#26334d]"
              }`}>
                <div className="flex items-center justify-between pb-3 border-b border-[#26334d]">
                  <div className="flex items-center gap-2">
                    <span className="text-xl">🏋️‍♂️</span>
                    <div>
                      <div className="font-bold text-white text-sm flex items-center gap-1.5">
                        ฝ่ายชาย (Male)
                        {winner === "MALE" && (
                          <Badge className="bg-amber-400/20 text-amber-300 border-amber-400/30 text-[10px] px-1.5 py-0">
                            👑 ผู้นำวินัย
                          </Badge>
                        )}
                      </div>
                      <span className="text-[11px] text-slate-400">
                        เป้า: เผาผลาญ {maleMaintenance} | ตัดทอน {maleDeficitTarget}
                      </span>
                    </div>
                  </div>

                  <div className="text-right">
                    <span className="text-xs text-slate-400 block">คะแนนวินัยวันนี้</span>
                    <span className="text-lg font-extrabold text-emerald-400 font-mono">
                      {maleScore} <span className="text-xs font-normal text-slate-400">/ 100</span>
                    </span>
                  </div>
                </div>

                {/* Score Progress Bar */}
                <div className="w-full bg-slate-800 rounded-full h-2 mt-3 overflow-hidden">
                  <div
                    className="bg-gradient-to-r from-emerald-500 to-teal-400 h-2 rounded-full transition-all duration-700"
                    style={{ width: `${Math.min(100, Math.max(5, maleScore))}%` }}
                  />
                </div>

                {/* Stats Grid */}
                <div className="grid grid-cols-2 gap-3 mt-4 text-xs">
                  <div className="bg-[#121826] p-2.5 rounded-xl border border-[#26334d]">
                    <span className="text-slate-400 block text-[11px]">🍽️ แคลอรี่ที่กินวันนี้:</span>
                    <span className="text-sm font-bold text-white font-mono">{maleCalories} kcal</span>
                    <span className="text-[10px] text-slate-400 block">โควต้า: ไม่เกิน {maleTargetIntake}</span>
                    <Badge className={`text-[10px] mt-1 px-1.5 py-0 ${
                      maleIntakeDiff >= 0
                        ? "bg-emerald-500/20 text-emerald-300 border-emerald-500/30"
                        : "bg-rose-500/20 text-rose-300 border-rose-500/30"
                    }`}>
                      {maleIntakeDiff >= 0 ? `เหลือ ${maleIntakeDiff} kcal` : `เกิน ${Math.abs(maleIntakeDiff)} kcal`}
                    </Badge>
                  </div>

                  <div className="bg-[#121826] p-2.5 rounded-xl border border-[#26334d]">
                    <span className="text-slate-400 block text-[11px]">🔥 ตัดทอนแคลอรี่วันนี้:</span>
                    <span className="text-sm font-bold text-amber-300 font-mono">
                      {maleDeficitToday >= 0 ? `-${maleDeficitToday} kcal` : `+${Math.abs(maleDeficitToday)} kcal`}
                    </span>
                    <span className="text-[10px] text-slate-400 block">เป้าตัดทอน: -{maleDeficitTarget}</span>
                    <Badge className={`text-[10px] mt-1 px-1.5 py-0 ${
                      maleDeficitToday >= maleDeficitTarget
                        ? "bg-emerald-500/20 text-emerald-300 border-emerald-500/30"
                        : maleDeficitToday > 0
                        ? "bg-amber-500/20 text-amber-300 border-amber-500/30"
                        : "bg-rose-500/20 text-rose-300 border-rose-500/30"
                    }`}>
                      {maleDeficitToday >= maleDeficitTarget ? "บรรลุเป้าตัดทอน ✨" : maleDeficitToday > 0 ? "ตัดทอนได้บางส่วน" : "Caloric Surplus"}
                    </Badge>
                  </div>

                  <div className="bg-[#121826] p-2.5 rounded-xl border border-[#26334d]">
                    <span className="text-slate-400 block text-[11px]">🥩 โปรตีนที่ได้รับ:</span>
                    <span className="text-sm font-bold text-emerald-300 font-mono">
                      {maleProtein.toFixed(1)}g <span className="text-xs text-slate-400">/ {maleTargetProtein}g</span>
                    </span>
                    <span className="text-[10px] text-slate-400 block">
                      คิดเป็น {((maleProtein / maleTargetProtein) * 100).toFixed(0)}% ของเป้า
                    </span>
                  </div>

                  <div className="bg-[#121826] p-2.5 rounded-xl border border-[#26334d]">
                    <span className="text-slate-400 block text-[11px]">📋 บันทึกอาหารวันนี้:</span>
                    <span className="text-sm font-bold text-white font-mono">{maleActiveMeals.length} มื้อ</span>
                    <span className="text-[10px] text-slate-400 block">
                      {maleActiveMeals.length > 0 ? "มีข้อมูลครบถ้วน" : "ยังไม่บันทึกมื้อ"}
                    </span>
                  </div>
                </div>
              </div>

              {/* Female Column */}
              <div className={`p-4 rounded-2xl border transition-all ${
                winner === "FEMALE"
                  ? "bg-pink-950/20 border-pink-500/50 shadow-lg shadow-pink-950/30"
                  : "bg-[#0b0f19] border-[#26334d]"
              }`}>
                <div className="flex items-center justify-between pb-3 border-b border-[#26334d]">
                  <div className="flex items-center gap-2">
                    <span className="text-xl">🧘‍♀️</span>
                    <div>
                      <div className="font-bold text-white text-sm flex items-center gap-1.5">
                        ฝ่ายหญิง (Female)
                        {winner === "FEMALE" && (
                          <Badge className="bg-amber-400/20 text-amber-300 border-amber-400/30 text-[10px] px-1.5 py-0">
                            👑 ผู้นำวินัย
                          </Badge>
                        )}
                      </div>
                      <span className="text-[11px] text-slate-400">
                        เป้า: เผาผลาญ {femaleMaintenance} | ตัดทอน {femaleDeficitTarget}
                      </span>
                    </div>
                  </div>

                  <div className="text-right">
                    <span className="text-xs text-slate-400 block">คะแนนวินัยวันนี้</span>
                    <span className="text-lg font-extrabold text-pink-400 font-mono">
                      {femaleScore} <span className="text-xs font-normal text-slate-400">/ 100</span>
                    </span>
                  </div>
                </div>

                {/* Score Progress Bar */}
                <div className="w-full bg-slate-800 rounded-full h-2 mt-3 overflow-hidden">
                  <div
                    className="bg-gradient-to-r from-pink-500 to-rose-400 h-2 rounded-full transition-all duration-700"
                    style={{ width: `${Math.min(100, Math.max(5, femaleScore))}%` }}
                  />
                </div>

                {/* Stats Grid */}
                <div className="grid grid-cols-2 gap-3 mt-4 text-xs">
                  <div className="bg-[#121826] p-2.5 rounded-xl border border-[#26334d]">
                    <span className="text-slate-400 block text-[11px]">🍽️ แคลอรี่ที่กินวันนี้:</span>
                    <span className="text-sm font-bold text-white font-mono">{femaleCalories} kcal</span>
                    <span className="text-[10px] text-slate-400 block">โควต้า: ไม่เกิน {femaleTargetIntake}</span>
                    <Badge className={`text-[10px] mt-1 px-1.5 py-0 ${
                      femaleIntakeDiff >= 0
                        ? "bg-pink-500/20 text-pink-300 border-pink-500/30"
                        : "bg-rose-500/20 text-rose-300 border-rose-500/30"
                    }`}>
                      {femaleIntakeDiff >= 0 ? `เหลือ ${femaleIntakeDiff} kcal` : `เกิน ${Math.abs(femaleIntakeDiff)} kcal`}
                    </Badge>
                  </div>

                  <div className="bg-[#121826] p-2.5 rounded-xl border border-[#26334d]">
                    <span className="text-slate-400 block text-[11px]">🔥 ตัดทอนแคลอรี่วันนี้:</span>
                    <span className="text-sm font-bold text-pink-300 font-mono">
                      {femaleDeficitToday >= 0 ? `-${femaleDeficitToday} kcal` : `+${Math.abs(femaleDeficitToday)} kcal`}
                    </span>
                    <span className="text-[10px] text-slate-400 block">เป้าตัดทอน: -{femaleDeficitTarget}</span>
                    <Badge className={`text-[10px] mt-1 px-1.5 py-0 ${
                      femaleDeficitToday >= femaleDeficitTarget
                        ? "bg-pink-500/20 text-pink-300 border-pink-500/30"
                        : femaleDeficitToday > 0
                        ? "bg-amber-500/20 text-amber-300 border-amber-500/30"
                        : "bg-rose-500/20 text-rose-300 border-rose-500/30"
                    }`}>
                      {femaleDeficitToday >= femaleDeficitTarget ? "บรรลุเป้าตัดทอน ✨" : femaleDeficitToday > 0 ? "ตัดทอนได้บางส่วน" : "Caloric Surplus"}
                    </Badge>
                  </div>

                  <div className="bg-[#121826] p-2.5 rounded-xl border border-[#26334d]">
                    <span className="text-slate-400 block text-[11px]">🥩 โปรตีนที่ได้รับ:</span>
                    <span className="text-sm font-bold text-pink-300 font-mono">
                      {femaleProtein.toFixed(1)}g <span className="text-xs text-slate-400">/ {femaleTargetProtein}g</span>
                    </span>
                    <span className="text-[10px] text-slate-400 block">
                      คิดเป็น {((femaleProtein / femaleTargetProtein) * 100).toFixed(0)}% ของเป้า
                    </span>
                  </div>

                  <div className="bg-[#121826] p-2.5 rounded-xl border border-[#26334d]">
                    <span className="text-slate-400 block text-[11px]">📋 บันทึกอาหารวันนี้:</span>
                    <span className="text-sm font-bold text-white font-mono">{femaleActiveMeals.length} มื้อ</span>
                    <span className="text-[10px] text-slate-400 block">
                      {femaleActiveMeals.length > 0 ? "มีข้อมูลครบถ้วน" : "ยังไม่บันทึกมื้อ"}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Coach Insight Summary Box */}
            <div className="p-3.5 rounded-xl bg-[#0b0f19] border border-indigo-500/30 text-xs text-slate-300 flex items-start gap-2.5">
              <Sparkles className="h-4 w-4 text-amber-400 shrink-0 mt-0.5" />
              <div>
                <strong className="text-white block mb-0.5">บทวิเคราะห์โภชนาการคู่รักประจำวัน (Couple AI Insights):</strong>
                <span>
                  {winner === "MALE"
                    ? `ฝ่ายชายทำได้ยอดเยี่ยมกว่าด้วยการคุมแคลอรี่ได้ดี (${maleCalories} / ${maleTargetIntake} kcal) และตัดทอนได้ตามเป้า ${maleDeficitToday} kcal แนะนำฝ่ายหญิงให้โฟกัสที่การคุมโควต้าอาหารเพื่อให้ทั้งคู่บรรลุเป้าหมายไปด้วยกัน!`
                    : winner === "FEMALE"
                    ? `ฝ่ายหญิงทำได้ยอดเยี่ยมกว่าด้วยการคุมแคลอรี่ได้ดี (${femaleCalories} / ${femaleTargetIntake} kcal) และตัดทอนได้ตามเป้า ${femaleDeficitToday} kcal แนะนำฝ่ายชายให้โฟกัสที่การคุมโควต้าอาหารเพื่อให้ทั้งคู่บรรลุเป้าหมายไปด้วยกัน!`
                    : winner === "TIE"
                    ? "ทั้งคู่มีวินัยยอดเยี่ยมและทำตามแผนได้อย่างดีเยี่ยมในระดับเดียวกัน ช่วยกันรักษามาตรฐานนี้ไว้อย่างต่อเนื่อง!"
                    : "บันทึกมื้ออาหารของวันนี้เพื่อรับผลวิเคราะห์และสรุปผลการเปรียบเทียบโภชนาการแบบ Real-Time"}
                </span>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* 🎯 FEATURE 1: WEIGHT LOSS PROJECT & DEADLINE SYSTEM */}
      <Card className="bg-gradient-to-br from-[#121a2d] to-[#151d2f] border-2 border-emerald-500/40 shadow-xl overflow-hidden">
        <CardHeader className="border-b border-[#26334d] pb-3 bg-[#0d1424]/70">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <div className="flex items-center gap-2">
                <CardTitle className="text-base font-bold text-white flex items-center gap-2">
                  <Target className="h-5 w-5 text-emerald-400" />
                  {activeProject ? activeProject.title : "โปรเจกต์ลดน้ำหนักและเดดไลน์"}
                </CardTitle>
                <Badge className="bg-emerald-500/20 text-emerald-300 border-emerald-500/30 text-[10px]">
                  {activeProject?.status === "active" ? "🟢 กำลังดำเนินการ" : "🏁 บันทึกสรุปแล้ว"}
                </Badge>
              </div>

              {activeProject ? (
                <div className="flex flex-wrap items-center gap-2 text-xs text-slate-300 mt-1">
                  <span>📅 เริ่ม: {formatThaiDate(activeProject.startDate)}</span>
                  <span>➔</span>
                  <span className="font-semibold text-amber-300 flex items-center gap-1">
                    <Clock className="h-3.5 w-3.5 text-amber-400" />
                    เดดไลน์: {formatThaiDate(activeProject.deadlineDate)}
                  </span>
                  <span>•</span>
                  <span className={projectAnalysis?.isOverdue ? "text-rose-400 font-semibold" : "text-emerald-400 font-semibold"}>
                    {projectAnalysis?.isOverdue ? "⚠️ เลยเดดไลน์แล้ว" : `⏳ เหลือเวลาอีก ${projectAnalysis?.daysRemaining} วัน`}
                  </span>
                </div>
              ) : (
                <CardDescription className="text-xs text-slate-400 mt-1">
                  กฎทางโภชนาการ: เพื่อลดไขมัน 1 กิโลกรัม ต้องตัดทอนแคลอรี่ออกประมาณ 7,500 kcal
                </CardDescription>
              )}
            </div>

            {/* Project Action Buttons */}
            <div className="flex items-center gap-2 flex-wrap">
              <Button onClick={() => setEditProjectOpen(true)} className="bg-amber-600 hover:bg-amber-500 text-white text-xs font-semibold h-8 px-3 shadow-md shadow-amber-950 flex items-center gap-1.5" title="แก้ไขเป้าหมายกิโลกรัมที่ต้องการลดและเดดไลน์ของโปรเจกต์นี้"><Pencil className="h-3.5 w-3.5" />แก้ไขโปรเจกต์</Button>
              <Button onClick={() => setProjectModalOpen(true)} className="bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold h-8 px-3 shadow-md shadow-emerald-950 flex items-center gap-1.5" title="ดูบทสรุปและรีวิวโปรเจกต์ย้อนหลัง">
                <Trophy className="h-3.5 w-3.5 text-amber-300" />
                สรุปผลรีวิวโปรเจกต์
              </Button>
              <Button
                onClick={() => setProjectModalOpen(true)}
                variant="outline"
                className="border-indigo-500/40 text-indigo-300 hover:text-white hover:bg-indigo-600/20 text-xs font-medium h-8 px-2.5"
                title="สร้างโปรเจกต์ลดน้ำหนักใหม่พร้อมเดดไลน์"
              >
                <Plus className="h-3.5 w-3.5" />
                สร้างโปรเจกต์ใหม่
              </Button>
            </div>
          </div>
        </CardHeader>

        <CardContent className="p-6 space-y-5">
          {/* แยกเป้าหมายตัดทอน กับเป้าหมายน้ำหนักตัวออกจากกันอย่างชัดเจน */}
          {(() => {
            const displayDeficitTarget = activeProject?.targetDeficitKcal || totalDeficitTargetKcal;
            const displayDeficitAchieved = projectAnalysis ? projectAnalysis.deficitAchieved : accumulatedDeficitKcal;
            const displayDeficitRemaining = Math.max(0, displayDeficitTarget - displayDeficitAchieved);
            const displayDeficitPct = Math.min(100, Math.max(0, projectAnalysis ? projectAnalysis.deficitProgressPct : deficitProgressPercent));

            const displayTargetKg = activeProject ? activeProject.targetFatLossKg : targetFatLossKg;
            const displayStartWeight = projectAnalysis?.startWeight || START_WEIGHT;
            const displayGoalWeight = activeProject?.targetWeight || (START_WEIGHT - targetFatLossKg);
            const displayCurrentWeight = projectAnalysis?.currentWeight || currentWeight;
            const displayWeightLost = projectAnalysis?.weightLost !== undefined ? projectAnalysis.weightLost : weightLostSoFar;
            const displayWeightRemaining = projectAnalysis?.weightRemaining !== undefined ? projectAnalysis.weightRemaining : remainingFatKg;
            const displayWeightPct = Math.min(100, Math.max(0, projectAnalysis ? projectAnalysis.weightProgressPct : weightProgressPercent));

            return (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {/* 1. CALORIE DEFICIT GOAL (จากอาหารจริงล้วนๆ) */}
                <div className="bg-[#0b0f19] p-4 rounded-xl border border-amber-500/30 space-y-3">
                  <div className="flex items-center justify-between border-b border-[#26334d] pb-2.5">
                    <div className="flex items-center gap-2">
                      <Flame className="h-4 w-4 text-amber-400" />
                      <span className="text-sm font-bold text-white">1. เป้าหมายตัดทอนแคลอรี่ (Calorie Deficit)</span>
                    </div>
                    <Badge className="bg-amber-500/20 text-amber-300 border-amber-500/30 text-[10px]">
                      คำนวณจากอาหารจริง
                    </Badge>
                  </div>

                  <div className="grid grid-cols-3 gap-2 text-xs">
                    <div className="bg-[#121826] p-2.5 rounded-lg border border-[#26334d]">
                      <span className="text-slate-400 block text-[10px]">เป้าตัดทอนรวม</span>
                      <span className="text-base font-bold text-amber-400 font-mono">
                        {displayDeficitTarget.toLocaleString()}
                      </span>
                      <span className="text-[10px] text-slate-500 block">kcal</span>
                    </div>

                    <div className="bg-[#121826] p-2.5 rounded-lg border border-[#26334d]">
                      <span className="text-slate-400 block text-[10px]">ตัดทอนสะสมได้จริง</span>
                      <span className={"text-base font-bold font-mono " + (displayDeficitAchieved > 0 ? "text-emerald-400" : "text-slate-300")}>
                        {Math.round(displayDeficitAchieved).toLocaleString()}
                      </span>
                      <span className="text-[10px] text-slate-500 block">kcal</span>
                    </div>

                    <div className="bg-[#121826] p-2.5 rounded-lg border border-[#26334d]">
                      <span className="text-slate-400 block text-[10px]">เหลือต้องตัดทอน</span>
                      <span className="text-base font-bold text-slate-300 font-mono">
                        {Math.round(displayDeficitRemaining).toLocaleString()}
                      </span>
                      <span className="text-[10px] text-slate-500 block">kcal</span>
                    </div>
                  </div>

                  {/* Progress Bar for Deficit */}
                  <div className="space-y-1.5 bg-[#121826] p-3 rounded-lg border border-[#26334d]">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-slate-300 text-[11px] font-medium">ความคืบหน้าตัดทอนแคลอรี่</span>
                      <Badge className="bg-amber-500/20 text-amber-300 border-amber-500/30 text-[11px] font-mono font-bold">
                        {"ทำไปแล้ว " + displayDeficitPct.toFixed(1) + "%"}
                      </Badge>
                    </div>
                    <div className="w-full bg-slate-800 rounded-full h-2.5 overflow-hidden p-0.5">
                      <div
                        className="bg-gradient-to-r from-amber-500 to-orange-400 h-1.5 rounded-full transition-all duration-700"
                        style={{ width: Math.max(displayDeficitPct > 0 ? 2 : 0, Math.min(100, displayDeficitPct)) + "%" }}
                      />
                    </div>
                    <div className="flex justify-between text-[10px] text-slate-400 pt-0.5">
                      <span>0 kcal (0%)</span>
                      <span className="font-mono">{Math.round(displayDeficitAchieved).toLocaleString()} / {displayDeficitTarget.toLocaleString()} kcal</span>
                    </div>
                  </div>
                </div>

                {/* 2. BODY WEIGHT GOAL (จากการชั่งน้ำหนักจริงล้วนๆ) */}
                <div className="bg-[#0b0f19] p-4 rounded-xl border border-emerald-500/30 space-y-3">
                  <div className="flex items-center justify-between border-b border-[#26334d] pb-2.5">
                    <div className="flex items-center gap-2">
                      <Scale className="h-4 w-4 text-emerald-400" />
                      <span className="text-sm font-bold text-white">2. เป้าหมายน้ำหนักตัว (Body Weight)</span>
                    </div>
                    <Badge className="bg-emerald-500/20 text-emerald-300 border-emerald-500/30 text-[10px]">
                      คำนวณจากการชั่งจริง
                    </Badge>
                  </div>

                  <div className="grid grid-cols-3 gap-2 text-xs">
                    <div className="bg-[#121826] p-2.5 rounded-lg border border-[#26334d]">
                      <div className="flex items-center justify-between"><span className="text-slate-400 block text-[10px]">เป้าหมายลด</span><button type="button" onClick={() => setEditProjectOpen(true)} className="text-[10px] text-amber-400 hover:underline flex items-center gap-0.5" title="แก้ไขจำนวนกิโลกรัม"><Pencil className="h-2.5 w-2.5" /><span>แก้ไข</span></button></div>
                      <span className="text-base font-bold text-white font-mono">
                        {displayTargetKg}
                      </span>
                      <span className="text-[10px] text-slate-500 block">กก. (เป้า {displayGoalWeight} กก.)</span>
                    </div>

                    <div className="bg-[#121826] p-2.5 rounded-lg border border-[#26334d]">
                      <span className="text-slate-400 block text-[10px]">ลดได้จริงแล้ว</span>
                      <span className="text-base font-bold text-emerald-300 font-mono">
                        {displayWeightLost}
                      </span>
                      <span className="text-[10px] text-slate-500 block">กก. (ล่าสุด {displayCurrentWeight} กก.)</span>
                    </div>

                    <div className="bg-[#121826] p-2.5 rounded-lg border border-[#26334d]">
                      <span className="text-slate-400 block text-[10px]">เหลืออีก</span>
                      <span className="text-base font-bold text-slate-300 font-mono">
                        {displayWeightRemaining}
                      </span>
                      <span className="text-[10px] text-slate-500 block">กก. จนถึงเป้า</span>
                    </div>
                  </div>

                  {/* Progress Bar for Weight */}
                  <div className="space-y-1.5 bg-[#121826] p-3 rounded-lg border border-[#26334d]">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-slate-300 text-[11px] font-medium">ความคืบหน้าน้ำหนักตัว</span>
                      <Badge className="bg-emerald-500/20 text-emerald-300 border-emerald-500/30 text-[11px] font-mono font-bold">
                        {"ลดได้แล้ว " + displayWeightPct.toFixed(1) + "%"}
                      </Badge>
                    </div>
                    <div className="w-full bg-slate-800 rounded-full h-2.5 overflow-hidden p-0.5">
                      <div
                        className="bg-gradient-to-r from-emerald-500 to-teal-400 h-1.5 rounded-full transition-all duration-700"
                        style={{ width: Math.max(displayWeightPct > 0 ? 2 : 0, Math.min(100, displayWeightPct)) + "%" }}
                      />
                    </div>
                    <div className="flex justify-between text-[10px] text-slate-400 pt-0.5">
                      <span>เริ่ม {displayStartWeight} กก. (0%)</span>
                      <span className="font-mono">ลดได้ {displayWeightLost} / {displayTargetKg} กก.</span>
                    </div>
                  </div>
                </div>
              </div>
            );
          })()}

          {/* 💡 Quick Retrospective Summary Bar (ตอบโจทย์: กินเกินไหม / ออกกำลังกาย / เวลานอน / ปรับตัว) */}
          <div className="p-3.5 rounded-xl bg-gradient-to-r from-[#0d1527] to-[#121c33] border border-indigo-500/30 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-xs">
            <div className="flex items-center gap-2">
              <Flame className="h-4 w-4 text-orange-400 shrink-0" />
              <div>
                <span className="text-slate-400 block text-[11px]">กินเกินไหม?</span>
                <strong className={projectAnalysis && projectAnalysis.daysOverIntake > 0 ? "text-amber-300" : "text-emerald-400"}>
                  {projectAnalysis && projectAnalysis.daysOverIntake > 0
                    ? `กินเกิน ${projectAnalysis.daysOverIntake} วัน (คุมดี ${projectAnalysis.daysCompliant} วัน)`
                    : "คุมแคลอรี่ได้ดี ไม่มีวันหลุด ✨"}
                </strong>
              </div>
            </div>

            <div className="flex items-center justify-between sm:justify-start gap-2">
              <div className="flex items-center gap-2">
                <Footprints className="h-4 w-4 text-indigo-400 shrink-0" />
                <div>
                  <div className="flex items-center gap-1">
                    <span className="text-slate-400 text-[11px]">
                      ก้าวเดิน (เป้า {(activeProject?.targetDailySteps || (isFemale ? femaleSettings.stepGoal : maleSettings.stepGoal) || 8000).toLocaleString()} ก้าว/วัน)
                    </span>
                    <button
                      type="button"
                      onClick={() => setStepGoalModalOpen(true)}
                      className="text-slate-500 hover:text-indigo-300 transition-colors p-0.5 rounded hover:bg-slate-800"
                      title="แก้ไขเป้าหมายก้าวเดิน"
                    >
                      <Pencil className="h-2.5 w-2.5" />
                    </button>
                  </div>
                  <strong className="text-indigo-300 font-mono">
                    {(() => {
                      const allStepLogs = getDailyStepLogs()
                      const target = activeProject?.targetDailySteps || (isFemale ? femaleSettings.stepGoal : maleSettings.stepGoal) || 8000
                      const pLog = allStepLogs.find((s) => s.date === activeDate && (isAll || s.person === (isFemale ? "ฝ่ายหญิง" : "ฝ่ายชาย")))
                      if (pLog) {
                        return `${Number(pLog.steps).toLocaleString()} ก้าว ${Number(pLog.steps) >= target ? "✅ ถึงเป้า" : `(ขาดอีก ${(target - Number(pLog.steps)).toLocaleString()})`}`
                      }
                      return `วันนี้ยังไม่บันทึก`
                    })()}
                  </strong>
                </div>
              </div>
              {onOpenAddStep && (
                <button
                  type="button"
                  onClick={onOpenAddStep}
                  className="text-[10px] bg-indigo-600/20 text-indigo-300 hover:bg-indigo-600 hover:text-white px-2.5 py-1 rounded-md border border-indigo-500/30 font-medium transition-all shrink-0 ml-auto sm:ml-2"
                >
                  + กรอกก้าว
                </button>
              )}
            </div>

            {/* Sleep & Wake Time Status */}
            <div className="flex items-center justify-between sm:justify-start gap-2">
              <div className="flex items-center gap-2">
                <Moon className="h-4 w-4 text-sky-400 shrink-0" />
                <div>
                  <span className="text-slate-400 block text-[11px]">
                    เวลานอน / ตื่น ({isToday ? "วันนี้" : formatThaiDate(activeDate)})
                  </span>
                  <strong className="text-sky-300 font-mono">
                    {(() => {
                      const allSleep = getSleepLogs()
                      if (isAll) {
                        const mSleep = allSleep.find((s) => s.date === activeDate && s.person === "ฝ่ายชาย")
                        const fSleep = allSleep.find((s) => s.date === activeDate && s.person === "ฝ่ายหญิง")
                        if (!mSleep && !fSleep) return "วันนี้ยังไม่บันทึกเวลานอน"
                        const mText = mSleep ? `ชาย ${mSleep.durationHours}ชม.` : "ชาย -"
                        const fText = fSleep ? `หญิง ${fSleep.durationHours}ชม.` : "หญิง -"
                        return `${mText} • ${fText}`
                      }
                      const targetP = isFemale ? "ฝ่ายหญิง" : "ฝ่ายชาย"
                      const pSleep = allSleep.find((s) => s.date === activeDate && s.person === targetP)
                      if (pSleep) {
                        const dur = calculateSleepDuration(pSleep.bedTime, pSleep.wakeTime)
                        return `🌙${pSleep.bedTime} ➔ ☀️${pSleep.wakeTime} (${dur.shortFormatted})`
                      }
                      return "วันนี้ยังไม่บันทึกเวลานอน"
                    })()}
                  </strong>
                </div>
              </div>
              {onOpenAddSleep && (
                <button
                  type="button"
                  onClick={() =>
                    onOpenAddSleep(
                      activeDate,
                      isFemale ? "ฝ่ายหญิง" : "ฝ่ายชาย"
                    )
                  }
                  className="text-[10px] bg-sky-600/20 text-sky-300 hover:bg-sky-600 hover:text-white px-2.5 py-1 rounded-md border border-sky-500/30 font-medium transition-all shrink-0 ml-auto sm:ml-2"
                >
                  + เวลานอน
                </button>
              )}
            </div>

            <div className="flex items-center justify-between sm:justify-end gap-2 flex-wrap">
              {onNavigateToSleep && (
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={onNavigateToSleep}
                  className="text-xs text-sky-400 hover:text-white hover:bg-sky-500/20 flex items-center gap-1 p-0 h-auto font-medium"
                >
                  <span>😴 สถิติการนอน</span>
                  <ArrowRight className="h-3 w-3" />
                </Button>
              )}
              {onNavigateToCalendar && (
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={onNavigateToCalendar}
                  className="text-xs text-emerald-400 hover:text-white hover:bg-emerald-500/20 flex items-center gap-1 p-0 h-auto font-medium"
                >
                  <span>📅 ปฏิทินดี/ร้าย</span>
                  <ArrowRight className="h-3 w-3" />
                </Button>
              )}
              <Button
                size="sm"
                variant="ghost"
                onClick={() => setProjectModalOpen(true)}
                className="text-xs text-amber-300 hover:text-white hover:bg-amber-500/20 flex items-center gap-1 p-0 h-auto font-medium"
              >
                <span>💡 บทเรียน</span>
                <ArrowRight className="h-3 w-3" />
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Unified Daily Metrics + 3-Category Food Group Summary */}
      <Card className="bg-[#151d2f] border-[#26334d]">
        <CardContent className="p-4 space-y-4">
          {/* Metric Cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {/* Calories Card */}
            <Card className="bg-[#0b0f19]/70 border-[#26334d] hover:border-emerald-500/40 transition-colors">
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <div>
              <CardTitle className="text-xs font-semibold text-white flex items-center gap-1">
                {isToday ? "แคลอรี่วันนี้ (โควต้ากิน)" : `แคลอรี่วันที่ ${formatThaiDate(activeDate)}`}
              </CardTitle>
              <span className="text-[10px] text-slate-400">
                เผาผลาญ {MAINTENANCE_CALORIES.toLocaleString()} - ตัดทอน {DEFICIT_TARGET.toLocaleString()}
              </span>
            </div>
            <button
              onClick={() => setCalorieModalOpen(true)}
              className={`p-2 rounded-xl transition-all hover:scale-105 cursor-pointer ${
                isMale ? "bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20" : "bg-pink-500/10 text-pink-400 hover:bg-pink-500/20"
              }`}
              title="คลิกเพื่อตั้งค่าแคลอรี่เผาผลาญ (TDEE) และเป้าหมายตัดทอน"
            >
              <Flame className="h-4 w-4" />
            </button>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-white">
              {totalCalories} <span className="text-xs font-normal text-slate-400">/ ไม่เกิน {TARGET_CALORIES.toLocaleString()} kcal</span>
            </div>
            <div className="mt-2 w-full bg-slate-800 rounded-full h-1.5 overflow-hidden">
              <div
                className={`h-1.5 rounded-full transition-all ${
                  totalCalories > TARGET_CALORIES
                    ? "bg-amber-500"
                    : isMale
                    ? "bg-emerald-500"
                    : "bg-pink-500"
                }`}
                style={{ width: `${Math.min(100, (totalCalories / TARGET_CALORIES) * 100)}%` }}
              />
            </div>
            <div className="flex items-center justify-between text-xs text-slate-400 mt-2">
              <span>{Math.round((totalCalories / TARGET_CALORIES) * 100)}% ของโควต้า</span>
              <span className={calorieDiff >= 0 ? "text-emerald-400 font-semibold" : "text-amber-400 font-semibold"}>
                {calorieDiff >= 0 ? `กินได้อีก ${calorieDiff} kcal` : `เกินโควต้า ${Math.abs(calorieDiff)} kcal`}
              </span>
            </div>
            <div className="mt-2 pt-2 border-t border-[#26334d]/60 flex items-center justify-between text-[11px]">
              <span className="text-slate-400">{isToday ? "ตัดทอนวันนี้:" : "ตัดทอนวันที่ดู:"}</span>
              <span className={`font-mono font-semibold ${
                MAINTENANCE_CALORIES - totalCalories >= DEFICIT_TARGET
                  ? "text-emerald-400"
                  : MAINTENANCE_CALORIES - totalCalories > 0
                  ? "text-amber-300"
                  : "text-rose-400"
              }`}>
                {MAINTENANCE_CALORIES - totalCalories >= 0
                  ? `-${(MAINTENANCE_CALORIES - totalCalories).toLocaleString()} kcal (ตัดทอนสำเร็จ)`
                  : `+${(totalCalories - MAINTENANCE_CALORIES).toLocaleString()} kcal (Caloric Surplus)`}
              </span>
            </div>
          </CardContent>
        </Card>

        {/* Protein Card */}
        <Card className="bg-[#0b0f19]/70 border-[#26334d] hover:border-emerald-500/40 transition-colors">
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-xs font-medium text-slate-400">โปรตีน (Protein)</CardTitle>
            <div className="p-2 rounded-xl bg-emerald-500/10 text-emerald-400">
              <Beef className="h-4 w-4" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-white">{totalProtein.toFixed(1)} <span className="text-xs font-normal text-slate-400">/ {TARGET_PROTEIN} g</span></div>
            <div className="mt-2 w-full bg-slate-800 rounded-full h-1.5 overflow-hidden">
              <div
                className="bg-emerald-400 h-1.5 rounded-full transition-all"
                style={{ width: `${Math.min(100, (totalProtein / TARGET_PROTEIN) * 100)}%` }}
              />
            </div>
            <p className="text-xs text-slate-400 mt-2">
              {Math.round((totalProtein / TARGET_PROTEIN) * 100)}% เสริมสร้างกล้ามเนื้อ
            </p>
          </CardContent>
        </Card>

        {/* Carbs Card */}
        <Card className="bg-[#0b0f19]/70 border-[#26334d] hover:border-amber-500/40 transition-colors">
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-xs font-medium text-slate-400">คาร์โบไฮเดรต (Carbs)</CardTitle>
            <div className="p-2 rounded-xl bg-amber-500/10 text-amber-400">
              <Wheat className="h-4 w-4" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-white">{totalCarbs.toFixed(1)} <span className="text-xs font-normal text-slate-400">/ {TARGET_CARBS} g</span></div>
            <div className="mt-2 w-full bg-slate-800 rounded-full h-1.5 overflow-hidden">
              <div
                className="bg-amber-400 h-1.5 rounded-full transition-all"
                style={{ width: `${Math.min(100, (totalCarbs / TARGET_CARBS) * 100)}%` }}
              />
            </div>
            <p className="text-xs text-slate-400 mt-2">
              {Math.round((totalCarbs / TARGET_CARBS) * 100)}% พลังงานหลัก
            </p>
            <p className="text-[11px] text-amber-300/90 mt-1">
              {(() => {
                const remainingCarbs = Math.max(0, TARGET_CARBS - totalCarbs)
                if (remainingCarbs <= 0) {
                  return `✅ ครบเป้าคาร์บ ${TARGET_CARBS} g แล้ว`
                }
                const remainingCalories = Math.max(0, TARGET_CALORIES - totalCalories)
                const remainingProtein = Math.max(0, TARGET_PROTEIN - totalProtein)
                const proteinReserveKcal = remainingProtein * 4
                const availableKcalForRice = Math.max(0, remainingCalories - proteinReserveKcal)
                const riceForCarbs = remainingCarbs / 0.28
                const maxRiceByCalories = availableKcalForRice / 1.3
                const recommendedRice = Math.round(Math.min(riceForCarbs, maxRiceByCalories))

                if (recommendedRice <= 0) {
                  return `⚠️ เก็บแคลที่เหลือ (${Math.round(remainingCalories)} kcal) ไว้ให้โปรตีนอีก ${remainingProtein.toFixed(0)} g`
                }
                const isCappedByCalories = maxRiceByCalories < riceForCarbs
                return isCappedByCalories
                  ? `🍚 กินข้าวสวยได้อีก ~${recommendedRice} กรัม (เผื่อแคลให้โปรตีน ${remainingProtein.toFixed(0)} g แล้ว)`
                  : `🍚 กินข้าวสวยเพิ่มอีก ~${recommendedRice} กรัม เพื่อให้ครบ ${TARGET_CARBS} g (เผื่อโปรตีนแล้ว)`
              })()}
            </p>
          </CardContent>
        </Card>

        {/* Fat Card */}
        <Card className="bg-[#0b0f19]/70 border-[#26334d] hover:border-rose-500/40 transition-colors">
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-xs font-medium text-slate-400">ไขมันดี (Good Fat)</CardTitle>
            <div className="p-2 rounded-xl bg-rose-500/10 text-rose-400">
              <Droplet className="h-4 w-4" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-white">{totalFat.toFixed(1)} <span className="text-xs font-normal text-slate-400">/ {TARGET_FAT} g</span></div>
            <div className="mt-2 w-full bg-slate-800 rounded-full h-1.5 overflow-hidden">
              <div
                className="bg-rose-400 h-1.5 rounded-full transition-all"
                style={{ width: `${Math.min(100, (totalFat / TARGET_FAT) * 100)}%` }}
              />
            </div>
            <p className="text-xs text-slate-400 mt-2">
              {Math.round((totalFat / TARGET_FAT) * 100)}% ฮอร์โมนและเซลล์
            </p>
          </CardContent>
        </Card>
      </div>

      {/* 3-Category Food Group Proportion Summary (inside same unified card) */}
      <div className="pt-4 border-t border-[#26334d] space-y-3">
        {(() => {
          const targetTotal =
            foodGroupTargets.protein.calories +
            foodGroupTargets.rice.calories +
            foodGroupTargets.snack.calories
          const safeTargetTotal = Math.max(targetTotal, 1)
          const totalPctOfTarget = Math.round((totalCalories / safeTargetTotal) * 100)
          const denominator = Math.max(targetTotal, totalCalories, 1)

          return (
            <>
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div className="text-sm font-semibold text-white flex items-center gap-2">
                  <UtensilsCrossed className="h-4 w-4 text-indigo-400" />
                  <span>
                    สัดส่วนการกินแยกตามกลุ่มอาหาร (จริง {Math.round(totalCalories).toLocaleString()} / เป้า{" "}
                    {targetTotal.toLocaleString()} kcal • {totalPctOfTarget}%)
                  </span>
                </div>
                <div className="text-xs space-y-0.5 sm:text-right">
                  <div className="font-medium text-indigo-300">
                    จริง (จากเป้า 100%):{" "}
                    {groupedActiveMeals
                      .map((g) => `${g.group.shortLabel} ${Math.round((g.calories / safeTargetTotal) * 100)}%`)
                      .join(" : ")}
                  </div>
                  <div className="text-[11px] text-slate-400">
                    เป้า ({isAll ? "รวมทั้งคู่" : selectedPerson}):{" "}
                    {groupedActiveMeals
                      .map((g) => `${g.group.shortLabel} ${foodGroupTargets[g.group.id].percent}%`)
                      .join(" : ")}
                  </div>
                </div>
              </div>

              {/* Stacked 3-segment progress bar (scaled against daily target kcal) */}
              <div className="h-2.5 w-full rounded-full bg-slate-800 overflow-hidden flex">
                {groupedActiveMeals.map((g) => {
                  const widthPct = (g.calories / denominator) * 100
                  const pctOfTarget = Math.round((g.calories / safeTargetTotal) * 100)
                  return widthPct > 0 ? (
                    <div
                      key={g.group.id}
                      style={{ width: `${widthPct}%` }}
                      className={`h-full ${g.group.barClass} transition-all duration-300`}
                      title={`${g.group.label}: ${g.calories} kcal (${pctOfTarget}% ของเป้าวัน)`}
                    />
                  ) : null
                })}
              </div>

              {/* Macro Doughnut (moved up) + 3 Food Group Summary Cards */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3 pt-1">
                {/* Macro Doughnut Card inside Unified Nutrition Section */}
                <div className="rounded-xl bg-[#0b0f19]/70 border border-[#26334d] p-3.5 flex flex-col items-center justify-between">
                  <div className="w-full flex items-center justify-between">
                    <span className="text-xs font-semibold text-white">
                      สัดส่วนสารอาหารวันนี้ (Macros)
                    </span>
                    <span className="text-[10px] text-slate-400">
                      {isAll ? "รวมทั้งคู่" : selectedPerson}
                    </span>
                  </div>
                  <div className="w-28 h-28 relative my-1.5">
                    <Doughnut
                      data={macroChartData}
                      options={{
                        responsive: true,
                        maintainAspectRatio: false,
                        plugins: { legend: { display: false } },
                      }}
                    />
                  </div>
                  <div className="flex items-center justify-center gap-2.5 text-[11px] w-full pt-1 border-t border-[#26334d]/60">
                    <span className="flex items-center gap-1 text-emerald-400 font-mono">
                      <span className="w-2 h-2 rounded-full bg-emerald-500 inline-block" />
                      P: {totalProtein.toFixed(0)}g
                    </span>
                    <span className="flex items-center gap-1 text-amber-400 font-mono">
                      <span className="w-2 h-2 rounded-full bg-amber-500 inline-block" />
                      C: {totalCarbs.toFixed(0)}g
                    </span>
                    <span className="flex items-center gap-1 text-rose-400 font-mono">
                      <span className="w-2 h-2 rounded-full bg-rose-500 inline-block" />
                      F: {totalFat.toFixed(0)}g
                    </span>
                  </div>
                </div>

                {groupedActiveMeals.map((g) => {
                  const target = foodGroupTargets[g.group.id]
                  const pctOfTarget = Math.round((g.calories / safeTargetTotal) * 100)
                  const diff = target.calories - g.calories
                  const fillPct = target.calories > 0 ? Math.min(100, Math.round((g.calories / target.calories) * 100)) : 0
                  const isOver = diff < 0
                  return (
                    <div
                      key={g.group.id}
                      className={`rounded-xl bg-[#0b0f19]/70 border ${g.group.borderClass} p-3.5 space-y-2 flex flex-col justify-between`}
                    >
                      <div className="space-y-2">
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-2 min-w-0">
                            <span className={`h-2.5 w-2.5 rounded-full shrink-0 ${g.group.dotClass}`} />
                            <span className="text-xs font-semibold text-white truncate">
                              {g.group.label}
                            </span>
                          </div>
                          <Badge
                            variant="secondary"
                            className={`text-[11px] font-semibold shrink-0 ${g.group.badgeClass}`}
                          >
                            {pctOfTarget}% / เป้า {target.percent}%
                          </Badge>
                        </div>

                        <div className="flex items-baseline justify-between gap-2">
                          <div className="flex items-baseline gap-1">
                            <span className="text-lg font-bold text-white">
                              {g.calories.toLocaleString()}
                            </span>
                            <span className="text-xs text-slate-400">
                              / {target.calories.toLocaleString()} kcal
                            </span>
                          </div>
                          <span className="text-[11px] text-slate-400">
                            {g.meals.length} รายการ
                          </span>
                        </div>

                        {/* Category target progress bar */}
                        <div className="h-1.5 w-full rounded-full bg-slate-800 overflow-hidden">
                          <div
                            style={{ width: `${fillPct}%` }}
                            className={`h-full rounded-full transition-all duration-300 ${
                              isOver ? "bg-rose-500" : g.group.barClass
                            }`}
                          />
                        </div>
                      </div>

                      <div className="flex items-center justify-between gap-2 text-[11px] pt-1">
                        <span className="text-slate-400">
                          P {g.protein}g • C {g.carbs}g • F {g.fat}g
                        </span>
                        <span
                          className={`font-medium shrink-0 ${
                            isOver
                              ? "text-rose-400"
                              : diff === 0
                                ? "text-emerald-400"
                                : "text-emerald-300"
                          }`}
                        >
                          {isOver
                            ? `เกิน +${Math.abs(diff).toLocaleString()} kcal`
                            : diff === 0
                              ? "ครบเป้าพอดี"
                              : `เหลือ ${diff.toLocaleString()} kcal`}
                        </span>
                      </div>
                    </div>
                  )
                })}
              </div>
            </>
          )
        })()}
      </div>
        </CardContent>
      </Card>

      {/* Side-by-Side Trend Charts Section: Calorie Trend vs Sleep Trend */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left: Dynamic Calorie Trend Bar Chart (7 / 14 / 30 Days) */}
        <Card className="bg-[#151d2f] border-[#26334d]">
          <CardHeader className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div>
              <CardTitle className="text-base font-semibold text-white flex items-center gap-2 flex-wrap">
                <span>แคลอรี่ {chartDaysRange} วันล่าสุด ({selectedPerson})</span>
                <Badge
                  variant="outline"
                  className={
                    last30AdherencePct >= 70
                      ? "border-emerald-500/40 text-emerald-300 bg-emerald-500/15"
                      : last30AdherencePct >= 40
                        ? "border-amber-500/40 text-amber-300 bg-amber-500/15"
                        : "border-rose-500/40 text-rose-300 bg-rose-500/15"
                  }
                >
                  ทำตามเป้า {last30AdherencePct}% ({last30OnTargetDays}/{last30LoggedDays} วัน)
                </Badge>
              </CardTitle>
              <CardDescription className="text-slate-400 text-xs mt-0.5">
                แนวโน้มการรับประทานอาหาร {chartDaysRange} วันล่าสุด เปรียบเทียบเป้าหมาย {TARGET_CALORIES.toLocaleString()} kcal
              </CardDescription>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              {/* Timeframe Switcher */}
              <div className="flex items-center gap-1 bg-[#0b0f19] p-1 rounded-lg border border-[#26334d]">
                {([7, 14, 30] as const).map((days) => (
                  <button
                    key={days}
                    type="button"
                    onClick={() => setChartDaysRange(days)}
                    className={`px-2 py-0.5 rounded text-[11px] font-medium transition-all ${
                      chartDaysRange === days
                        ? "bg-emerald-600 text-white font-semibold"
                        : "text-slate-400 hover:text-white"
                    }`}
                  >
                    {days} วัน
                  </button>
                ))}
              </div>
              <Badge variant="outline" className="border-emerald-500/40 text-emerald-400 bg-emerald-500/10">
                นน. ล่าสุด: {currentWeight} kg (เป้า {ULTIMATE_TARGET_WEIGHT} kg)
              </Badge>
              <Button
                variant="ghost"
                size="sm"
                onClick={onOpenAddWeight}
                className="text-[11px] h-7 px-2 text-indigo-300 hover:text-white hover:bg-indigo-600/20 border border-indigo-500/30"
              >
                <Scale className="h-3 w-3 mr-1" />
                ชั่งน้ำหนัก
              </Button>
            </div>
          </CardHeader>
          <CardContent className="h-64 pt-2">
            <Bar
              key={`cal-${selectedPerson}-${TARGET_CALORIES}-${chartDaysRange}`}
              data={weeklyBarData}
              plugins={[targetLinePlugin]}
              options={{
                responsive: true,
                maintainAspectRatio: false,
                scales: {
                  y: {
                    grid: { color: "rgba(255, 255, 255, 0.05)" },
                    ticks: { color: "#94a3b8" },
                  },
                  x: {
                    grid: { display: false },
                    ticks: { color: "#94a3b8", font: { size: 10 }, maxRotation: 45, autoSkip: true },
                  },
                },
                plugins: {
                  legend: {
                    display: isAll,
                    labels: { color: "#94a3b8", font: { size: 11 } },
                  },
                },
              }}
            />
          </CardContent>
        </Card>

        {/* Right: Dynamic Sleep Trend Bar Chart (7 / 14 / 30 Days) matching the Calorie Chart */}
        <Card className="bg-[#151d2f] border-[#26334d]">
          <CardHeader className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div>
              <CardTitle className="text-base font-semibold text-white flex items-center gap-2 flex-wrap">
                <span>เวลานอน {sleepDaysRange} วันล่าสุด ({selectedPerson})</span>
                <Badge
                  variant="outline"
                  className={
                    lastSleepAdherencePct >= 70
                      ? "border-emerald-500/40 text-emerald-300 bg-emerald-500/15"
                      : lastSleepAdherencePct >= 40
                        ? "border-amber-500/40 text-amber-300 bg-amber-500/15"
                        : "border-rose-500/40 text-rose-300 bg-rose-500/15"
                  }
                >
                  ทำตามเป้า {lastSleepAdherencePct}% ({lastSleepOnTargetDays}/{lastSleepLoggedDays} วัน)
                </Badge>
              </CardTitle>
              <CardDescription className="text-slate-400 text-xs mt-0.5">
                แนวโน้มการนอนหลับ {sleepDaysRange} วันล่าสุด เปรียบเทียบเป้าหมาย {activeSleepGoal} ชม. (สีเขียว ≥ {activeSleepGoal} ชม. • เหลือง 6-{activeSleepGoal} ชม. • แดง &lt; 6 ชม.)
              </CardDescription>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              {/* Timeframe Switcher */}
              <div className="flex items-center gap-1 bg-[#0b0f19] p-1 rounded-lg border border-[#26334d]">
                {([7, 14, 30] as const).map((days) => (
                  <button
                    key={days}
                    type="button"
                    onClick={() => setSleepDaysRange(days)}
                    className={`px-2 py-0.5 rounded text-[11px] font-medium transition-all ${
                      sleepDaysRange === days
                        ? "bg-emerald-600 text-white font-semibold"
                        : "text-slate-400 hover:text-white"
                    }`}
                  >
                    {days} วัน
                  </button>
                ))}
              </div>
              <Badge variant="outline" className="border-emerald-500/40 text-emerald-400 bg-emerald-500/10">
                เฉลี่ย: {avgSleepHoursInRange} ชม. (เป้า {activeSleepGoal} ชม.)
              </Badge>
              {onOpenAddSleep && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() =>
                    onOpenAddSleep(
                      activeDate,
                      selectedPerson === "ALL" ? "ฝ่ายชาย" : selectedPerson
                    )
                  }
                  className="text-[11px] h-7 px-2 text-sky-300 hover:text-white hover:bg-sky-600/20 border border-sky-500/30"
                >
                  <Moon className="h-3 w-3 mr-1" />
                  จดเวลานอน
                </Button>
              )}
            </div>
          </CardHeader>
          <CardContent className="h-64 pt-2">
            <Bar
              key={`sleep-${selectedPerson}-${activeSleepGoal}-${sleepDaysRange}`}
              data={sleepBarData}
              plugins={[sleepTargetLinePlugin]}
              options={{
                responsive: true,
                maintainAspectRatio: false,
                scales: {
                  y: {
                    beginAtZero: true,
                    suggestedMax: 10,
                    grid: { color: "rgba(255, 255, 255, 0.05)" },
                    ticks: { color: "#94a3b8" },
                  },
                  x: {
                    grid: { display: false },
                    ticks: { color: "#94a3b8", font: { size: 10 }, maxRotation: 45, autoSkip: true },
                  },
                },
                plugins: {
                  legend: {
                    display: isAll,
                    labels: { color: "#94a3b8", font: { size: 11 } },
                  },
                  tooltip: {
                    callbacks: {
                      afterLabel(context: any) {
                        const idx = context.dataIndex
                        const entry = isAll
                          ? context.datasetIndex === 0
                            ? sleepMaleEntriesByDate[idx]
                            : sleepFemaleEntriesByDate[idx]
                          : isMale
                          ? sleepMaleEntriesByDate[idx]
                          : sleepFemaleEntriesByDate[idx]
                        if (entry) {
                          return `เข้านอน ${entry.bedTime} น. - ตื่น ${entry.wakeTime} น. (${entry.quality})`
                        }
                        return ""
                      },
                    },
                  },
                },
              }}
            />
          </CardContent>
        </Card>
      </div>

      {/* Active Date Meals Timeline */}
      <Card className="bg-[#151d2f] border-[#26334d]">
        <CardHeader className="flex flex-row items-center justify-between pb-3">
          <div>
            <CardTitle className="text-base font-semibold text-white flex items-center gap-2">
              <UtensilsCrossed className="h-4 w-4 text-emerald-400" />
              มื้ออาหารประจำวันที่ {formatThaiDate(activeDate)} {isToday && "(วันนี้)"} ({isAll ? "รวมทั้งคู่ ชาย & หญิง" : selectedPerson} - {activeDateMeals.length} รายการ)
            </CardTitle>
            <CardDescription className="text-slate-400 text-xs">
              ข้อมูลที่บันทึกไว้ใน Google Sheets (B หน้าจดบันทึก)
            </CardDescription>
          </div>
          <div className="flex items-center gap-2">
            <Button
              onClick={() => onOpenAddMeal(activeDate)}
              size="sm"
              className="bg-emerald-600 hover:bg-emerald-500 text-white text-xs flex items-center gap-1"
            >
              <Plus className="h-3.5 w-3.5" />
              + บันทึกมื้อ
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={onNavigateToMealPlan}
              className="text-xs text-emerald-400 hover:text-emerald-300 hover:bg-emerald-500/10 flex items-center gap-1"
            >
              ดูแผนทั้งหมด <ArrowRight className="h-3 w-3" />
            </Button>
          </div>
        </CardHeader>

        <CardContent>
          {activeDateMeals.length === 0 ? (
            <div className="text-center py-8 border border-dashed border-[#26334d] rounded-xl">
              <p className="text-slate-400 text-sm">
                {isToday
                  ? `ยังไม่มีมื้ออาหารที่บันทึกไว้สำหรับ ${isAll ? "ทั้งคู่" : selectedPerson} ในวันนี้ (${formatThaiDate(activeDate)})`
                  : `ไม่มีมื้ออาหารที่บันทึกไว้สำหรับ ${isAll ? "ทั้งคู่" : selectedPerson} ในวันที่ ${formatThaiDate(activeDate)}`}
              </p>
              <Button
                onClick={() => onOpenAddMeal(activeDate)}
                variant="outline"
                className="mt-3 text-xs border-[#26334d] text-emerald-400 hover:bg-emerald-500/10"
              >
                + บันทึกมื้ออาหารของ{isToday ? "วันนี้" : "วันที่นี้"}
              </Button>
            </div>
          ) : (
            <div className="space-y-4">
              {/* Grouped Meal Lists by 3 Categories */}
                {groupedActiveMeals.map((g) => (
                  <div
                    key={g.group.id}
                    className={`rounded-xl border ${g.group.borderClass} bg-[#0b0f19]/40 overflow-hidden`}
                  >
                    <div
                      className={`px-3.5 py-2.5 ${g.group.headerBgClass} border-b border-[#26334d] flex flex-wrap items-center justify-between gap-2`}
                    >
                      <div className="flex items-center gap-2">
                        <span className={`h-2.5 w-2.5 rounded-full ${g.group.dotClass}`} />
                        <span className="text-sm font-semibold text-white">
                          {g.group.label}
                        </span>
                        <Badge
                          variant="secondary"
                          className={`text-[10px] ${g.group.badgeClass}`}
                        >
                          {g.meals.length} รายการ • {g.percent}%
                        </Badge>
                      </div>
                      <div className="flex items-center gap-3 text-xs">
                        <span className="text-slate-400 hidden sm:inline">
                          P: {g.protein}g • C: {g.carbs}g • F: {g.fat}g
                        </span>
                        <span className={`font-semibold ${g.group.kcalTextClass}`}>
                          {g.calories.toLocaleString()} kcal
                        </span>
                      </div>
                    </div>

                    {g.meals.length === 0 ? (
                      <div className="px-4 py-3 text-xs text-slate-500">
                        ยังไม่มีรายการอาหารในหมวดนี้
                      </div>
                    ) : (
                      <div className="divide-y divide-[#26334d] px-2">
                        {g.meals.map((meal) => {
                          const id = meal.id || meal.ID
                          const isMaleMeal = meal.person === "ฝ่ายชาย"
                          return (
                            <div
                              key={id}
                              className="py-3 flex items-center justify-between gap-4 hover:bg-slate-800/30 px-2 rounded-lg transition-colors"
                            >
                              <div className="flex items-center gap-3">
                                <div className={`p-1 rounded-full ${isMaleMeal ? "bg-emerald-500/20 text-emerald-400" : "bg-pink-500/20 text-pink-400"}`}>
                                  <CheckCircle2 className="h-4 w-4" />
                                </div>

                                <div>
                                  <div className="flex items-center gap-2 flex-wrap">
                                    <span className="text-sm font-medium text-white">
                                      {meal.foodName || meal.FoodName}
                                    </span>
                                    {isAll && (
                                      <Badge
                                        variant="secondary"
                                        className={`text-[10px] whitespace-nowrap ${
                                          isMaleMeal
                                            ? "bg-emerald-500/20 text-emerald-300 border-emerald-500/30"
                                            : "bg-pink-500/20 text-pink-300 border-pink-500/30"
                                        }`}
                                      >
                                        {isMaleMeal ? "🏋️‍♂️ ชาย" : "🧘‍♀️ หญิง"}
                                      </Badge>
                                    )}
                                    <Badge
                                      variant="secondary"
                                      className="text-[10px] bg-slate-800 text-slate-300 border-slate-700"
                                    >
                                      {meal.mealType || meal.MealType}
                                    </Badge>
                                    {meal.servings && (
                                      <span className="text-xs text-slate-400">({meal.servings} เสิร์ฟ)</span>
                                    )}
                                  </div>
                                  {meal.notes && (
                                    <p className="text-xs text-slate-400 mt-0.5">{meal.notes}</p>
                                  )}
                                </div>
                              </div>

                              <div className="text-right shrink-0">
                                <span className="text-sm font-semibold text-emerald-400">
                                  {meal.calories} kcal
                                </span>
                                <div className="text-[10px] text-slate-400 space-x-1">
                                  <span>P: {meal.protein}g</span>
                                  <span>•</span>
                                  <span>C: {meal.carbs}g</span>
                                  <span>•</span>
                                  <span>F: {meal.fat}g</span>
                                </div>
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    )}
                  </div>
                ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Calorie & TDEE Settings Modal */}
      <CalorieSettingsModal
        open={calorieModalOpen}
        onOpenChange={setCalorieModalOpen}
        currentPerson={selectedPerson}
        onSaved={setCalorieSettings}
      />

      {/* Weight Loss Project & Deadline Review Modal */}
      <ProjectReviewModal
        open={projectModalOpen}
        onOpenChange={setProjectModalOpen}
        currentPerson={selectedPerson === "ALL" ? "ฝ่ายชาย" : selectedPerson}
        meals={meals}
        healthLogs={healthLogs}
        maintenanceCalories={MAINTENANCE_CALORIES}
        targetIntakeCalories={TARGET_CALORIES}
        onProjectUpdated={(newP) => setActiveProject(newP)}
      />

      {/* Set Step Goal Modal */}
      <SetStepGoalModal
        open={stepGoalModalOpen}
        onOpenChange={setStepGoalModalOpen}
        currentPerson={isFemale ? "ฝ่ายหญิง" : "ฝ่ายชาย"}
        currentGoal={activeProject?.targetDailySteps || (isFemale ? femaleSettings.stepGoal : maleSettings.stepGoal) || 8000}
        onSaved={(_newGoal) => {
          setCalorieSettings(getCalorieSettings())
          setActiveProject(getActiveProject(isFemale ? "ฝ่ายหญิง" : "ฝ่ายชาย"))
        }}
      />

      {/* Edit Active Project Modal */}
      <EditProjectModal
        open={editProjectOpen}
        onOpenChange={setEditProjectOpen}
        project={activeProject || getActiveProject(isFemale ? "ฝ่ายหญิง" : "ฝ่ายชาย")}
        onSaved={(updated) => {
          setActiveProject(updated)
          setTargetFatLossKg(updated.targetFatLossKg)
        }}
      />
    </div>
  )
}
