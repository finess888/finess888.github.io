import * as React from "react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  SleepLogEntry,
  getSleepLogs,
  deleteSleepLog,
  calculateSleepDuration,
  evaluateSleepStatus,
  getSleepGoal,
  calculateSleepRoutineStats,
  isLateBedtime,
} from "@/lib/sleepTracker"
import { getCalorieSettings, getIntakeTarget } from "@/lib/calorieSettings"
import { formatThaiDate } from "@/lib/utils"
import {
  Moon,
  Sun,
  Clock,
  Plus,
  Trash2,
  Pencil,
  Sparkles,
  CheckCircle2,
  Target,
  Zap,
  AlertTriangle,
  Flame,
  Filter,
  ChevronLeft,
  ChevronRight,
  Calendar,
  Lightbulb,
} from "lucide-react"
import { Bar } from "react-chartjs-2"
import { toast } from "sonner"

interface SleepTrackerViewProps {
  selectedPerson?: string
  onSelectPerson?: (p: string) => void
  onOpenAddSleep: (date?: string, person?: string) => void
  meals?: any[]
}

type TimeRangeFilter = "7d" | "14d" | "30d" | "all"
type RoutineStatusFilter = "all" | "optimal" | "late_bedtime" | "short_sleep" | "poor_quality"

export function SleepTrackerView({
  selectedPerson = "ฝ่ายชาย",
  onSelectPerson,
  onOpenAddSleep,
  meals = [],
}: SleepTrackerViewProps) {
  const [sleepLogs, setSleepLogs] = React.useState<SleepLogEntry[]>(getSleepLogs)
  const [personFilter, setPersonFilter] = React.useState<string>(selectedPerson)
  const [timeRange, setTimeRange] = React.useState<TimeRangeFilter>("14d")
  const [routineFilter, setRoutineFilter] = React.useState<RoutineStatusFilter>("all")
  const [filterDate, setFilterDate] = React.useState<string>("")

  const todayStr = new Date().toLocaleDateString("en-CA")
  const [activeDayCardDate, setActiveDayCardDate] = React.useState<string>(todayStr)

  const reloadData = () => {
    setSleepLogs(getSleepLogs())
  }

  React.useEffect(() => {
    reloadData()
  }, [])

  React.useEffect(() => {
    if (selectedPerson) {
      setPersonFilter(selectedPerson)
    }
  }, [selectedPerson])

  const handlePersonChange = (p: string) => {
    setPersonFilter(p)
    if (onSelectPerson) {
      onSelectPerson(p)
    }
  }

  const handleDeleteLog = (id: string, dateStr: string, person: string) => {
    if (
      window.confirm(
        `คุณต้องการลบบันทึกเวลานอนของ ${person} วันที่ ${formatThaiDate(dateStr)} ใช่หรือไม่?`
      )
    ) {
      deleteSleepLog(id)
      reloadData()
      toast.success("ลบบันทึกเวลานอนเรียบร้อยแล้ว")
    }
  }

  // Date navigation for Daily Card
  const handlePrevDay = () => {
    const cur = new Date(activeDayCardDate + "T12:00:00")
    cur.setDate(cur.getDate() - 1)
    setActiveDayCardDate(cur.toLocaleDateString("en-CA"))
  }

  const handleNextDay = () => {
    const cur = new Date(activeDayCardDate + "T12:00:00")
    cur.setDate(cur.getDate() + 1)
    setActiveDayCardDate(cur.toLocaleDateString("en-CA"))
  }

  // Calculate start date for timeRange filter
  const rangeStartDate = React.useMemo(() => {
    if (timeRange === "all") return undefined
    const days = timeRange === "7d" ? 6 : timeRange === "14d" ? 13 : 29
    const d = new Date()
    d.setDate(d.getDate() - days)
    return d.toLocaleDateString("en-CA")
  }, [timeRange])

  const maleTodayLog = sleepLogs.find(
    (s) => s.date === activeDayCardDate && s.person === "ฝ่ายชาย"
  )
  const femaleTodayLog = sleepLogs.find(
    (s) => s.date === activeDayCardDate && s.person === "ฝ่ายหญิง"
  )

  const maleGoal = maleTodayLog?.sleepGoalHours || getSleepGoal("ฝ่ายชาย") || 8
  const femaleGoal = femaleTodayLog?.sleepGoalHours || getSleepGoal("ฝ่ายหญิง") || 8

  // Routine & Energy Summary Statistics (respecting person & timeframe filters)
  const stats = React.useMemo(
    () =>
      calculateSleepRoutineStats(sleepLogs, {
        person: personFilter,
        startDate: filterDate || rangeStartDate,
        endDate: filterDate || todayStr,
      }),
    [sleepLogs, personFilter, rangeStartDate, filterDate, todayStr]
  )

  // Correlation: Sleep Routine vs Daily Calorie Control (Fat Loss Impact)
  const sleepNutritionCorrelation = React.useMemo(() => {
    const calSettings = getCalorieSettings()
    const logsInScope = sleepLogs.filter((l) => {
      if (personFilter !== "ALL" && l.person !== personFilter) return false
      if (rangeStartDate && l.date < rangeStartDate) return false
      return true
    })

    let goodSleepTotalCal = 0
    let goodSleepDaysWithMeals = 0
    let goodSleepOverTargetDays = 0

    let poorSleepTotalCal = 0
    let poorSleepDaysWithMeals = 0
    let poorSleepOverTargetDays = 0

    logsInScope.forEach((log) => {
      const targetIntake =
        log.person === "ฝ่ายหญิง"
          ? getIntakeTarget(calSettings.female)
          : getIntakeTarget(calSettings.male)

      const dayMeals = meals.filter((m) => {
        const mDate = String(m.date || m.Date || "").split("T")[0]
        const mPerson = String(m.person || m.Person || "").trim()
        return mDate === log.date && (mPerson === log.person || mPerson === "ทั้งคู่")
      })

      if (dayMeals.length > 0) {
        const cals = dayMeals.reduce(
          (sum, m) => sum + (Number(m.calories || m.Calories) || 0),
          0
        )
        const isGoodSleep =
          log.durationHours >= (log.sleepGoalHours || 7.5) &&
          !isLateBedtime(log.bedTime, 23, 59)

        if (isGoodSleep) {
          goodSleepTotalCal += cals
          goodSleepDaysWithMeals++
          if (cals > targetIntake) goodSleepOverTargetDays++
        } else {
          poorSleepTotalCal += cals
          poorSleepDaysWithMeals++
          if (cals > targetIntake) poorSleepOverTargetDays++
        }
      }
    })

    return {
      goodSleepDaysWithMeals,
      goodSleepAvgCal:
        goodSleepDaysWithMeals > 0
          ? Math.round(goodSleepTotalCal / goodSleepDaysWithMeals)
          : 0,
      goodSleepOverTargetDays,
      poorSleepDaysWithMeals,
      poorSleepAvgCal:
        poorSleepDaysWithMeals > 0
          ? Math.round(poorSleepTotalCal / poorSleepDaysWithMeals)
          : 0,
      poorSleepOverTargetDays,
    }
  }, [sleepLogs, meals, personFilter, rangeStartDate])

  // Filtered table logs (applying Person + Timeframe + Specific Date + Routine Issue Filter)
  const filteredLogs = React.useMemo(() => {
    return sleepLogs.filter((l) => {
      const matchPerson = personFilter === "ALL" || l.person === personFilter
      if (!matchPerson) return false

      if (filterDate) {
        if (l.date !== filterDate) return false
      } else if (rangeStartDate && l.date < rangeStartDate) {
        return false
      }

      const goal = l.sleepGoalHours || 7.5
      if (routineFilter === "optimal") {
        return l.durationHours >= goal && !isLateBedtime(l.bedTime, 23, 30)
      }
      if (routineFilter === "late_bedtime") {
        return isLateBedtime(l.bedTime, 23, 30)
      }
      if (routineFilter === "short_sleep") {
        return l.durationHours < 6
      }
      if (routineFilter === "poor_quality") {
        return (
          l.quality === "หลับไม่สนิท (Light)" || l.quality === "เพลีย/นอนน้อย (Poor)"
        )
      }

      return true
    })
  }, [sleepLogs, personFilter, filterDate, rangeStartDate, routineFilter])

  // Dynamic Chart Days based on TimeRangeFilter (7, 14, or 30 days)
  const chartDaysCount = timeRange === "7d" ? 7 : timeRange === "30d" ? 30 : 14
  const chartDates: string[] = []
  const chartLabels: string[] = []
  for (let i = chartDaysCount - 1; i >= 0; i--) {
    const d = new Date()
    d.setDate(d.getDate() - i)
    const iso = d.toLocaleDateString("en-CA")
    chartDates.push(iso)
    chartLabels.push(`${d.getDate()}/${d.getMonth() + 1}`)
  }

  const maleChartHours = chartDates.map((iso) => {
    const found = sleepLogs.find((l) => l.date === iso && l.person === "ฝ่ายชาย")
    return found ? found.durationHours : 0
  })

  const femaleChartHours = chartDates.map((iso) => {
    const found = sleepLogs.find((l) => l.date === iso && l.person === "ฝ่ายหญิง")
    return found ? found.durationHours : 0
  })

  const getSinglePersonBarColors = (values: number[], goalH: number) => {
    return values.map((h) => {
      if (h >= goalH) return "rgba(16, 185, 129, 0.85)" // Emerald: optimal
      if (h >= 6) return "rgba(245, 158, 11, 0.85)" // Amber: fair
      return "rgba(244, 63, 94, 0.85)" // Rose: short sleep (<6h)
    })
  }

  const activeGoalHours =
    personFilter === "ฝ่ายหญิง" ? femaleGoal : maleGoal

  const chartData =
    personFilter === "ALL"
      ? {
          labels: chartLabels,
          datasets: [
            {
              label: "🏋️‍♂️ ฝ่ายชาย (ชั่วโมง)",
              data: maleChartHours,
              backgroundColor: "rgba(16, 185, 129, 0.8)",
              borderColor: "#10b981",
              borderRadius: 6,
            },
            {
              label: "🧘‍♀️ ฝ่ายหญิง (ชั่วโมง)",
              data: femaleChartHours,
              backgroundColor: "rgba(236, 72, 153, 0.8)",
              borderColor: "#ec4899",
              borderRadius: 6,
            },
          ],
        }
      : {
          labels: chartLabels,
          datasets: [
            {
              label: `${personFilter} (ชั่วโมงการนอน)`,
              data: personFilter === "ฝ่ายชาย" ? maleChartHours : femaleChartHours,
              backgroundColor: getSinglePersonBarColors(
                personFilter === "ฝ่ายชาย" ? maleChartHours : femaleChartHours,
                activeGoalHours
              ),
              borderRadius: 6,
            },
          ],
        }

  const sleepTargetLinePlugin = React.useMemo(
    () => ({
      id: "sleepTargetLine",
      afterDatasetsDraw(chart: any) {
        const { ctx, chartArea, scales } = chart
        if (!chartArea || !scales?.y) return
        const yPos = scales.y.getPixelForValue(activeGoalHours)
        if (yPos < chartArea.top || yPos > chartArea.bottom) return

        ctx.save()
        ctx.beginPath()
        ctx.setLineDash([6, 4])
        ctx.lineWidth = 2
        ctx.strokeStyle = "#38bdf8"
        ctx.moveTo(chartArea.left, yPos)
        ctx.lineTo(chartArea.right, yPos)
        ctx.stroke()

        const labelText = `เป้า ${activeGoalHours} ชม.`
        ctx.font = "600 11px sans-serif"
        const textWidth = ctx.measureText(labelText).width
        const boxW = textWidth + 12
        const boxH = 18
        const boxX = chartArea.right - boxW - 4
        const boxY = Math.max(chartArea.top + 2, yPos - boxH - 4)

        ctx.setLineDash([])
        ctx.fillStyle = "rgba(15, 23, 42, 0.9)"
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
    [activeGoalHours]
  )

  return (
    <div className="space-y-6">
      {/* Top Header & Primary Controls */}
      <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4 bg-gradient-to-r from-slate-900 via-[#151d2f] to-[#151d2f] border border-[#26334d] rounded-2xl p-6 shadow-lg">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Moon className="h-6 w-6 text-sky-400" />
            <h1 className="text-2xl font-bold text-white tracking-tight flex items-center gap-2 flex-wrap">
              ระบบวิเคราะห์รูทีนการนอน & พลังงานรายวัน
              <Badge className="bg-sky-500/20 text-sky-300 border-sky-500/30 text-xs">
                Fat Loss & Daily Energy
              </Badge>
            </h1>
          </div>
          <p className="text-slate-400 text-xs sm:text-sm">
            จัดระเบียบเวลาเข้านอน-เวลาตื่น เพื่อปรับสมดุลฮอร์โมนเผาผลาญไขมัน (Growth Hormone & Cortisol) และตื่นมาพร้อมพลังงานสดชื่นตลอดวัน
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {/* Person Filter */}
          <div className="flex items-center gap-1 bg-[#0b0f19] p-1 rounded-xl border border-[#26334d]">
            <button
              onClick={() => handlePersonChange("ฝ่ายชาย")}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all ${
                personFilter === "ฝ่ายชาย"
                  ? "bg-emerald-600 text-white shadow-md shadow-emerald-950"
                  : "text-slate-400 hover:text-white"
              }`}
            >
              <span>🏋️‍♂️</span> ฝ่ายชาย
            </button>
            <button
              onClick={() => handlePersonChange("ฝ่ายหญิง")}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all ${
                personFilter === "ฝ่ายหญิง"
                  ? "bg-pink-600 text-white shadow-md shadow-pink-950"
                  : "text-slate-400 hover:text-white"
              }`}
            >
              <span>🧘‍♀️</span> ฝ่ายหญิง
            </button>
            <button
              onClick={() => handlePersonChange("ALL")}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all ${
                personFilter === "ALL"
                  ? "bg-indigo-600 text-white shadow-md shadow-indigo-950"
                  : "text-slate-400 hover:text-white"
              }`}
            >
              <span>👥</span> รวมคู่รัก
            </button>
          </div>

          <Button
            onClick={() =>
              onOpenAddSleep(
                activeDayCardDate,
                personFilter === "ALL" ? "ฝ่ายชาย" : personFilter
              )
            }
            className="bg-sky-600 hover:bg-sky-500 text-white font-semibold text-xs h-9 px-3.5 shadow-md shadow-sky-950 flex items-center gap-1.5"
          >
            <Plus className="h-4 w-4" />
            + บันทึกเวลานอน / ตื่น
          </Button>
        </div>
      </div>

      {/* 🔍 ADVANCED FILTER BAR (กรองช่วงเวลา & กรองปัญหารูทีน) */}
      <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3 bg-[#111726] border border-[#26334d] p-3.5 rounded-2xl shadow-md">
        {/* Timeframe Filter */}
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="text-xs text-slate-400 font-medium flex items-center gap-1 mr-1">
            <Calendar className="h-3.5 w-3.5 text-sky-400" />
            ช่วงเวลาสถิติ:
          </span>
          {(
            [
              { key: "7d", label: "7 วันล่าสุด" },
              { key: "14d", label: "14 วันล่าสุด" },
              { key: "30d", label: "30 วันล่าสุด" },
              { key: "all", label: "ทั้งหมด" },
            ] as { key: TimeRangeFilter; label: string }[]
          ).map((t) => (
            <button
              key={t.key}
              type="button"
              onClick={() => {
                setTimeRange(t.key)
                setFilterDate("")
              }}
              className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-all ${
                timeRange === t.key && !filterDate
                  ? "bg-sky-600 text-white font-semibold shadow-sm"
                  : "bg-[#0b0f19] text-slate-400 hover:text-white border border-[#26334d]"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* Routine Status / Issue Filter */}
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="text-xs text-slate-400 font-medium flex items-center gap-1 mr-1">
            <Filter className="h-3.5 w-3.5 text-amber-400" />
            กรองรูทีน:
          </span>
          {(
            [
              { key: "all", label: "ทุกรายการ" },
              { key: "optimal", label: "✅ นอนดี & ไม่ดึก" },
              { key: "late_bedtime", label: "🌙 นอนดึก (>23:30)" },
              { key: "short_sleep", label: "⚠️ นอนน้อย (<6 ชม.)" },
              { key: "poor_quality", label: "🥱 หลับไม่สนิท/เพลีย" },
            ] as { key: RoutineStatusFilter; label: string }[]
          ).map((rf) => (
            <button
              key={rf.key}
              type="button"
              onClick={() => setRoutineFilter(rf.key)}
              className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-all ${
                routineFilter === rf.key
                  ? "bg-indigo-600 text-white font-semibold shadow-sm"
                  : "bg-[#0b0f19] text-slate-400 hover:text-white border border-[#26334d]"
              }`}
            >
              {rf.label}
            </button>
          ))}
        </div>
      </div>

      {/* 📊 6 KEY ROUTINE & ENERGY KPI CARDS */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        {/* KPI 1: เวลานอนเฉลี่ย */}
        <Card className="bg-[#151d2f] border-[#26334d]">
          <CardContent className="p-3.5 space-y-1">
            <span className="text-[11px] text-slate-400 flex items-center justify-between">
              <span>เวลานอนเฉลี่ย</span>
              <Clock className="h-3.5 w-3.5 text-sky-400" />
            </span>
            <div className="text-xl font-extrabold text-white font-mono">
              {stats.avgFormatted}
            </div>
            <span className="text-[10px] text-emerald-400 block">
              ครบเป้า {stats.goalMetDays}/{stats.totalLogs} คืน ({stats.goalMetPct}%)
            </span>
          </CardContent>
        </Card>

        {/* KPI 2: เวลาเข้านอนเฉลี่ย (Avg Bedtime) */}
        <Card className="bg-[#151d2f] border-[#26334d]">
          <CardContent className="p-3.5 space-y-1">
            <span className="text-[11px] text-slate-400 flex items-center justify-between">
              <span>เข้านอนเฉลี่ย</span>
              <Moon className="h-3.5 w-3.5 text-indigo-400" />
            </span>
            <div className="text-xl font-extrabold text-indigo-300 font-mono">
              {stats.avgBedTime} <span className="text-xs font-normal">น.</span>
            </div>
            <span className="text-[10px] text-slate-400 block">
              เป้า Golden Hour: ก่อน 23:00 น.
            </span>
          </CardContent>
        </Card>

        {/* KPI 3: เวลาตื่นนอนเฉลี่ย (Avg Wake Time) */}
        <Card className="bg-[#151d2f] border-[#26334d]">
          <CardContent className="p-3.5 space-y-1">
            <span className="text-[11px] text-slate-400 flex items-center justify-between">
              <span>ตื่นนอนเฉลี่ย</span>
              <Sun className="h-3.5 w-3.5 text-amber-400" />
            </span>
            <div className="text-xl font-extrabold text-amber-300 font-mono">
              {stats.avgWakeTime} <span className="text-xs font-normal">น.</span>
            </div>
            <span className="text-[10px] text-slate-400 block">
              นาฬิกาชีวิตยามเช้า
            </span>
          </CardContent>
        </Card>

        {/* KPI 4: ดัชนีพลังงานรายวัน (Energy & Recovery Score) */}
        <Card className="bg-[#151d2f] border-emerald-500/30">
          <CardContent className="p-3.5 space-y-1">
            <span className="text-[11px] text-emerald-300 flex items-center justify-between font-medium">
              <span>ระดับพลังงานเฉลี่ย</span>
              <Zap className="h-3.5 w-3.5 text-amber-400" />
            </span>
            <div className="text-xl font-extrabold text-emerald-400 font-mono">
              {stats.avgEnergyScore}{" "}
              <span className="text-xs font-normal text-slate-400">/ 100</span>
            </div>
            <span className="text-[10px] text-slate-300 block truncate">
              {stats.avgEnergyScore >= 80
                ? "⚡ พลังงานสดชื่นดีมาก"
                : stats.avgEnergyScore >= 65
                ? "🔋 พลังงานปานกลาง"
                : "🪫 ควรเพิ่มเวลานอน"}
            </span>
          </CardContent>
        </Card>

        {/* KPI 5: วินัยเข้านอนเร็ว (Golden Hours Rate) */}
        <Card className="bg-[#151d2f] border-[#26334d]">
          <CardContent className="p-3.5 space-y-1">
            <span className="text-[11px] text-slate-400 flex items-center justify-between">
              <span>นอนก่อน 23:30 น.</span>
              <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />
            </span>
            <div className="text-xl font-extrabold text-white font-mono">
              {stats.goldenHourPct}%
            </div>
            <span className="text-[10px] text-slate-400 block">
              ทำได้ {stats.goldenHourDays} คืน • นอนดึก {stats.lateNightDays} คืน
            </span>
          </CardContent>
        </Card>

        {/* KPI 6: คืนที่นอนน้อย / ต้องระวัง */}
        <Card className="bg-[#151d2f] border-rose-500/30">
          <CardContent className="p-3.5 space-y-1">
            <span className="text-[11px] text-rose-300 flex items-center justify-between">
              <span>คืนที่นอนน้อย (&lt;6 ชม.)</span>
              <AlertTriangle className="h-3.5 w-3.5 text-rose-400" />
            </span>
            <div className="text-xl font-extrabold text-rose-400 font-mono">
              {stats.shortSleepDays} <span className="text-xs font-normal">คืน</span>
            </div>
            <span className="text-[10px] text-slate-400 block">
              หลับสนิท/ดี {stats.deepQualityDays} คืน
            </span>
          </CardContent>
        </Card>
      </div>

      {/* 💡 ACTIONABLE ROUTINE & FAT-LOSS INSIGHT BANNER + SLEEP-NUTRITION CORRELATION */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Left 2 cols: Routine Coach Advice */}
        <Card className="lg:col-span-2 bg-gradient-to-br from-[#121a30] to-[#181c36] border border-sky-500/40 shadow-lg">
          <CardContent className="p-4 sm:p-5 space-y-3">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 text-sm font-bold text-white">
                <Lightbulb className="h-4 w-4 text-amber-400" />
                <span>บทวิเคราะห์รูทีนการนอนเพื่อลดน้ำหนัก & เพิ่มพลังงาน (Routine Coach)</span>
              </div>
              <Badge className="bg-sky-500/20 text-sky-300 border-sky-500/30 text-[10px]">
                วิเคราะห์จาก {stats.totalLogs} รายการ
              </Badge>
            </div>
            <p className="text-xs sm:text-sm text-slate-200 leading-relaxed">
              {stats.routineAdvice}
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 pt-1 text-[11px]">
              <div className="p-2.5 rounded-lg bg-[#0b0f19]/80 border border-[#26334d]">
                <strong className="text-sky-300 block">1. ช่วงเวลาเผาผลาญ (22:00-02:00)</strong>
                <span className="text-slate-400">
                  Growth Hormone หลั่งสูงสุดเมื่อหลับสนิทก่อนเที่ยงคืน ช่วยดึงไขมันสะสมมาใช้และซ่อมแซมกล้ามเนื้อ
                </span>
              </div>
              <div className="p-2.5 rounded-lg bg-[#0b0f19]/80 border border-[#26334d]">
                <strong className="text-emerald-300 block">2. คุมฮอร์โมนหิว (Ghrelin & Leptin)</strong>
                <span className="text-slate-400">
                  การนอนครบ 7.5-8 ชม. ลดความอยากของหวานและแป้งในวันถัดไปได้ถึง 30-45%
                </span>
              </div>
              <div className="p-2.5 rounded-lg bg-[#0b0f19]/80 border border-[#26334d]">
                <strong className="text-amber-300 block">3. ล็อกเวลาตื่นเช้าให้คงที่</strong>
                <span className="text-slate-400">
                  ตื่นเวลาใกล้เคียงกันทุกวัน ({stats.avgWakeTime !== "--:--" ? `เฉลี่ย ${stats.avgWakeTime} น.` : "เช่น 06:30-07:30 น."}) และรับแสงแดดเช้าช่วยให้มีพลังงานทันที
                </span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Right 1 col: Sleep vs Calorie Intake Correlation */}
        <Card className="bg-[#151d2f] border border-indigo-500/30 shadow-lg">
          <CardHeader className="p-4 pb-2">
            <CardTitle className="text-sm font-bold text-white flex items-center gap-2">
              <Flame className="h-4 w-4 text-orange-400" />
              ความสัมพันธ์: การนอน vs การกินแคลอรี่
            </CardTitle>
            <CardDescription className="text-[11px] text-slate-400">
              เปรียบเทียบแคลอรี่ที่กินในวันที่นอนดี vs วันที่นอนดึก/นอนน้อย
            </CardDescription>
          </CardHeader>
          <CardContent className="p-4 pt-2 space-y-2.5 text-xs">
            <div className="p-2.5 rounded-xl bg-[#0b0f19] border border-emerald-500/30 flex items-center justify-between">
              <div>
                <span className="text-emerald-300 font-semibold block">
                  ✅ วันที่นอนพอ & ไม่ดึก ({sleepNutritionCorrelation.goodSleepDaysWithMeals} วัน)
                </span>
                <span className="text-[10px] text-slate-400">
                  หลุดโควต้า {sleepNutritionCorrelation.goodSleepOverTargetDays} วัน
                </span>
              </div>
              <div className="text-right font-mono">
                <span className="text-base font-bold text-emerald-400">
                  {sleepNutritionCorrelation.goodSleepAvgCal > 0
                    ? `${sleepNutritionCorrelation.goodSleepAvgCal.toLocaleString()} kcal`
                    : "--"}
                </span>
                <span className="text-[10px] text-slate-500 block">แคลอรี่เฉลี่ย</span>
              </div>
            </div>

            <div className="p-2.5 rounded-xl bg-[#0b0f19] border border-rose-500/30 flex items-center justify-between">
              <div>
                <span className="text-rose-300 font-semibold block">
                  ⚠️ วันที่นอนน้อย / นอนดึก ({sleepNutritionCorrelation.poorSleepDaysWithMeals} วัน)
                </span>
                <span className="text-[10px] text-slate-400">
                  หลุดโควต้า {sleepNutritionCorrelation.poorSleepOverTargetDays} วัน
                </span>
              </div>
              <div className="text-right font-mono">
                <span className="text-base font-bold text-rose-400">
                  {sleepNutritionCorrelation.poorSleepAvgCal > 0
                    ? `${sleepNutritionCorrelation.poorSleepAvgCal.toLocaleString()} kcal`
                    : "--"}
                </span>
                <span className="text-[10px] text-slate-500 block">แคลอรี่เฉลี่ย</span>
              </div>
            </div>

            <p className="text-[11px] text-slate-400 pt-0.5">
              {sleepNutritionCorrelation.poorSleepAvgCal >
                sleepNutritionCorrelation.goodSleepAvgCal &&
              sleepNutritionCorrelation.goodSleepAvgCal > 0
                ? `💡 สถิติชี้ชัด: วันที่นอนน้อย/นอนดึก กินแคลอรี่สูงกว่าวันที่นอนพอเฉลี่ย +${(
                    sleepNutritionCorrelation.poorSleepAvgCal -
                    sleepNutritionCorrelation.goodSleepAvgCal
                  ).toLocaleString()} kcal/วัน!`
                : "💡 บันทึกเวลานอนควบคู่มื้ออาหารทุกวัน เพื่อดูผลกระทบของการนอนต่อความหิวและการคุมแคลอรี่"}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* 😴 DAILY COUPLE SLEEP & ENERGY CARD (เลือกวันดูย้อนหลังได้) */}
      <Card className="bg-gradient-to-br from-[#10172b] via-[#131b31] to-[#191834] border-2 border-indigo-500/40 shadow-xl overflow-hidden">
        <CardHeader className="p-4 pb-3 border-b border-[#26334d] flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <CardTitle className="text-base font-bold text-white flex items-center gap-2">
              <Moon className="h-5 w-5 text-indigo-400" />
              สรุปรูทีนการนอน & พลังงานรายวัน (Daily Couple Sleep & Energy)
            </CardTitle>
            <CardDescription className="text-xs text-slate-400">
              ประจำวันที่ {formatThaiDate(activeDayCardDate)} • เป้าหมายการนอนเพื่อฟื้นฟูระบบเผาผลาญ: 7.5 - 8 ชั่วโมง/คืน
            </CardDescription>
          </div>

          {/* Date Stepper for Daily Card */}
          <div className="flex items-center gap-1.5 flex-wrap">
            <Button
              variant="outline"
              size="sm"
              onClick={handlePrevDay}
              className="border-[#26334d] bg-[#0b0f19] text-slate-300 hover:text-white h-8 px-2"
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Input
              type="date"
              value={activeDayCardDate}
              onChange={(e) => setActiveDayCardDate(e.target.value)}
              className="bg-[#0b0f19] border-[#26334d] text-white text-xs h-8 w-36 font-mono"
            />
            <Button
              variant="outline"
              size="sm"
              onClick={handleNextDay}
              className="border-[#26334d] bg-[#0b0f19] text-slate-300 hover:text-white h-8 px-2"
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
            {activeDayCardDate !== todayStr && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setActiveDayCardDate(todayStr)}
                className="text-xs text-sky-400 hover:text-white h-8 px-2"
              >
                วันนี้
              </Button>
            )}
          </div>
        </CardHeader>

        <CardContent className="p-4 sm:p-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Male Sleep Card */}
            {(() => {
              const dur = maleTodayLog
                ? calculateSleepDuration(maleTodayLog.bedTime, maleTodayLog.wakeTime)
                : null
              const evalStatus = maleTodayLog
                ? evaluateSleepStatus(
                    maleTodayLog.durationHours,
                    maleGoal,
                    maleTodayLog.bedTime,
                    maleTodayLog.quality
                  )
                : null
              const pct = maleTodayLog
                ? Math.min(100, Math.round((maleTodayLog.durationHours / maleGoal) * 100))
                : 0

              return (
                <div className="p-4 rounded-xl bg-[#0b0f19] border border-emerald-500/30 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-bold text-white flex items-center gap-1.5">
                      <span>🏋️‍♂️</span> ฝ่ายชาย (Male)
                    </span>
                    <div className="flex items-center gap-1.5">
                      {maleTodayLog && evalStatus ? (
                        <Badge className={`text-[10px] ${evalStatus.badgeClass}`}>
                          {evalStatus.label}
                        </Badge>
                      ) : (
                        <Badge className="bg-slate-800 text-slate-400 border-slate-700 text-[10px]">
                          ยังไม่บันทึก
                        </Badge>
                      )}
                      <button
                        onClick={() => onOpenAddSleep(activeDayCardDate, "ฝ่ายชาย")}
                        className="p-1 rounded-lg bg-[#151d2f] text-slate-300 hover:text-white border border-[#26334d]"
                        title="แก้ไข/บันทึกเวลานอนฝ่ายชาย"
                      >
                        <Pencil className="h-3 w-3" />
                      </button>
                    </div>
                  </div>

                  {maleTodayLog && dur && evalStatus ? (
                    <>
                      <div className="flex items-baseline justify-between flex-wrap gap-2">
                        <div>
                          <span className="text-2xl font-extrabold text-white font-mono">
                            {dur.formatted}
                          </span>
                          <span className="text-xs text-slate-400 ml-1.5">
                            / เป้า {maleGoal} ชม.
                          </span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <Badge className="bg-sky-500/20 text-sky-300 border-sky-500/30 text-[10px] font-mono">
                            ⚡ พลังงาน {evalStatus.energyScore}/100
                          </Badge>
                          <Badge
                            variant="outline"
                            className="text-[10px] border-indigo-500/30 text-indigo-300"
                          >
                            {maleTodayLog.quality}
                          </Badge>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-2 text-xs">
                        <div className="p-2.5 rounded-lg bg-[#121826] border border-[#26334d] flex items-center justify-between">
                          <span className="text-slate-400 flex items-center gap-1">
                            <Moon className="h-3.5 w-3.5 text-indigo-400" />
                            เข้านอน:
                          </span>
                          <strong
                            className={`font-mono text-sm ${
                              isLateBedtime(maleTodayLog.bedTime, 23, 30)
                                ? "text-rose-300"
                                : "text-indigo-300"
                            }`}
                          >
                            {maleTodayLog.bedTime} น.
                          </strong>
                        </div>
                        <div className="p-2.5 rounded-lg bg-[#121826] border border-[#26334d] flex items-center justify-between">
                          <span className="text-slate-400 flex items-center gap-1">
                            <Sun className="h-3.5 w-3.5 text-amber-400" />
                            ตื่นนอน:
                          </span>
                          <strong className="text-amber-300 font-mono text-sm">
                            {maleTodayLog.wakeTime} น.
                          </strong>
                        </div>
                      </div>

                      <div className="w-full bg-slate-800 rounded-full h-2 overflow-hidden">
                        <div
                          className="bg-gradient-to-r from-indigo-500 to-emerald-400 h-2 rounded-full transition-all duration-700"
                          style={{ width: `${pct}%` }}
                        />
                      </div>

                      <div className="text-[11px] text-slate-300 flex items-center justify-between pt-0.5">
                        <span>{evalStatus.energyLabel}</span>
                        {maleTodayLog.notes && (
                          <span className="text-slate-400 truncate max-w-[180px]">
                            📝 {maleTodayLog.notes}
                          </span>
                        )}
                      </div>
                    </>
                  ) : (
                    <div className="py-5 text-center space-y-2">
                      <p className="text-xs text-slate-500">
                        ยังไม่ได้บันทึกเวลานอนและเวลาตื่นของวันที่{" "}
                        {formatThaiDate(activeDayCardDate)}
                      </p>
                      <Button
                        size="sm"
                        onClick={() => onOpenAddSleep(activeDayCardDate, "ฝ่ายชาย")}
                        className="bg-emerald-600/20 hover:bg-emerald-600 text-emerald-300 hover:text-white border border-emerald-500/30 text-xs h-8"
                      >
                        + บันทึกเวลานอนฝ่ายชาย
                      </Button>
                    </div>
                  )}
                </div>
              )
            })()}

            {/* Female Sleep Card */}
            {(() => {
              const dur = femaleTodayLog
                ? calculateSleepDuration(femaleTodayLog.bedTime, femaleTodayLog.wakeTime)
                : null
              const evalStatus = femaleTodayLog
                ? evaluateSleepStatus(
                    femaleTodayLog.durationHours,
                    femaleGoal,
                    femaleTodayLog.bedTime,
                    femaleTodayLog.quality
                  )
                : null
              const pct = femaleTodayLog
                ? Math.min(100, Math.round((femaleTodayLog.durationHours / femaleGoal) * 100))
                : 0

              return (
                <div className="p-4 rounded-xl bg-[#0b0f19] border border-pink-500/30 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-bold text-white flex items-center gap-1.5">
                      <span>🧘‍♀️</span> ฝ่ายหญิง (Female)
                    </span>
                    <div className="flex items-center gap-1.5">
                      {femaleTodayLog && evalStatus ? (
                        <Badge className={`text-[10px] ${evalStatus.badgeClass}`}>
                          {evalStatus.label}
                        </Badge>
                      ) : (
                        <Badge className="bg-slate-800 text-slate-400 border-slate-700 text-[10px]">
                          ยังไม่บันทึก
                        </Badge>
                      )}
                      <button
                        onClick={() => onOpenAddSleep(activeDayCardDate, "ฝ่ายหญิง")}
                        className="p-1 rounded-lg bg-[#151d2f] text-slate-300 hover:text-white border border-[#26334d]"
                        title="แก้ไข/บันทึกเวลานอนฝ่ายหญิง"
                      >
                        <Pencil className="h-3 w-3" />
                      </button>
                    </div>
                  </div>

                  {femaleTodayLog && dur && evalStatus ? (
                    <>
                      <div className="flex items-baseline justify-between flex-wrap gap-2">
                        <div>
                          <span className="text-2xl font-extrabold text-white font-mono">
                            {dur.formatted}
                          </span>
                          <span className="text-xs text-slate-400 ml-1.5">
                            / เป้า {femaleGoal} ชม.
                          </span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <Badge className="bg-sky-500/20 text-sky-300 border-sky-500/30 text-[10px] font-mono">
                            ⚡ พลังงาน {evalStatus.energyScore}/100
                          </Badge>
                          <Badge
                            variant="outline"
                            className="text-[10px] border-pink-500/30 text-pink-300"
                          >
                            {femaleTodayLog.quality}
                          </Badge>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-2 text-xs">
                        <div className="p-2.5 rounded-lg bg-[#121826] border border-[#26334d] flex items-center justify-between">
                          <span className="text-slate-400 flex items-center gap-1">
                            <Moon className="h-3.5 w-3.5 text-indigo-400" />
                            เข้านอน:
                          </span>
                          <strong
                            className={`font-mono text-sm ${
                              isLateBedtime(femaleTodayLog.bedTime, 23, 30)
                                ? "text-rose-300"
                                : "text-indigo-300"
                            }`}
                          >
                            {femaleTodayLog.bedTime} น.
                          </strong>
                        </div>
                        <div className="p-2.5 rounded-lg bg-[#121826] border border-[#26334d] flex items-center justify-between">
                          <span className="text-slate-400 flex items-center gap-1">
                            <Sun className="h-3.5 w-3.5 text-amber-400" />
                            ตื่นนอน:
                          </span>
                          <strong className="text-amber-300 font-mono text-sm">
                            {femaleTodayLog.wakeTime} น.
                          </strong>
                        </div>
                      </div>

                      <div className="w-full bg-slate-800 rounded-full h-2 overflow-hidden">
                        <div
                          className="bg-gradient-to-r from-indigo-500 to-pink-400 h-2 rounded-full transition-all duration-700"
                          style={{ width: `${pct}%` }}
                        />
                      </div>

                      <div className="text-[11px] text-slate-300 flex items-center justify-between pt-0.5">
                        <span>{evalStatus.energyLabel}</span>
                        {femaleTodayLog.notes && (
                          <span className="text-slate-400 truncate max-w-[180px]">
                            📝 {femaleTodayLog.notes}
                          </span>
                        )}
                      </div>
                    </>
                  ) : (
                    <div className="py-5 text-center space-y-2">
                      <p className="text-xs text-slate-500">
                        ยังไม่ได้บันทึกเวลานอนและเวลาตื่นของวันที่{" "}
                        {formatThaiDate(activeDayCardDate)}
                      </p>
                      <Button
                        size="sm"
                        onClick={() => onOpenAddSleep(activeDayCardDate, "ฝ่ายหญิง")}
                        className="bg-pink-600/20 hover:bg-pink-600 text-pink-300 hover:text-white border border-pink-500/30 text-xs h-8"
                      >
                        + บันทึกเวลานอนฝ่ายหญิง
                      </Button>
                    </div>
                  )}
                </div>
              )
            })()}
          </div>
        </CardContent>
      </Card>

      {/* Dynamic Sleep Duration Trend Chart */}
      <Card className="bg-[#151d2f] border-[#26334d]">
        <CardHeader className="p-4 pb-2 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <CardTitle className="text-base font-semibold text-white flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-sky-400" />
              แนวโน้มชั่วโมงการนอน {chartDaysCount} วันล่าสุด (
              {personFilter === "ALL" ? "เปรียบเทียบ ชาย vs หญิง" : personFilter})
            </CardTitle>
            <CardDescription className="text-xs text-slate-400">
              แสดงจำนวนชั่วโมงการนอนเทียบเส้นเป้าหมาย ({activeGoalHours} ชม.) • สีเขียว = นอนพอ, สีเหลือง = 6-{activeGoalHours} ชม., สีแดง = นอนน้อยกว่า 6 ชม.
            </CardDescription>
          </div>
        </CardHeader>
        <CardContent className="h-64 pt-2">
          <Bar
            key={`${personFilter}-${timeRange}-${activeGoalHours}`}
            data={chartData}
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
                  ticks: { color: "#94a3b8", font: { size: 11 } },
                },
              },
              plugins: {
                legend: {
                  display: personFilter === "ALL",
                  labels: { color: "#cbd5e1", font: { size: 11 } },
                },
              },
            }}
          />
        </CardContent>
      </Card>

      {/* Sleep Logs History Table */}
      <Card className="bg-[#151d2f] border-[#26334d] overflow-hidden">
        <CardHeader className="p-4 pb-3 border-b border-[#26334d] flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <CardTitle className="text-base font-semibold text-white flex items-center gap-2">
              <Moon className="h-4 w-4 text-indigo-400" />
              ประวัติบันทึกเวลานอนและเวลาตื่น ({filteredLogs.length} รายการ)
            </CardTitle>
            <CardDescription className="text-xs text-slate-400">
              กรองตามช่วงเวลา บุคคล หรืออาการรูทีนที่ต้องการตรวจสอบ
            </CardDescription>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <Input
              type="date"
              value={filterDate}
              onChange={(e) => setFilterDate(e.target.value)}
              className="bg-[#0b0f19] border-[#26334d] text-white text-xs h-8 w-36"
            />
            {(filterDate || routineFilter !== "all" || timeRange !== "14d") && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setFilterDate("")
                  setRoutineFilter("all")
                  setTimeRange("14d")
                }}
                className="text-xs text-slate-400 hover:text-white h-8 px-2"
              >
                รีเซ็ตตัวกรอง
              </Button>
            )}
          </div>
        </CardHeader>

        <div className="overflow-x-auto max-h-[500px]">
          <Table>
            <TableHeader className="bg-[#0e1422] border-b border-[#26334d] sticky top-0">
              <TableRow className="border-[#26334d]">
                <TableHead className="text-slate-300">วันที่</TableHead>
                <TableHead className="text-slate-300">บุคคล</TableHead>
                <TableHead className="text-center text-indigo-300">🌙 เวลาเข้านอน</TableHead>
                <TableHead className="text-center text-amber-300">☀️ เวลาตื่นนอน</TableHead>
                <TableHead className="text-center text-slate-300">⏰ รวมเวลานอน</TableHead>
                <TableHead className="text-center text-sky-300">⚡ คะแนนพลังงาน</TableHead>
                <TableHead className="text-slate-300">คุณภาพการนอน</TableHead>
                <TableHead className="text-slate-300">สถานะรูทีน</TableHead>
                <TableHead className="text-slate-300">บันทึก</TableHead>
                <TableHead className="w-16 text-center text-slate-400">จัดการ</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredLogs.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={10} className="text-center py-10 text-slate-400">
                    ไม่พบข้อมูลบันทึกเวลานอนตามตัวกรองที่เลือก
                  </TableCell>
                </TableRow>
              ) : (
                filteredLogs.map((log) => {
                  const isMaleEntry = log.person === "ฝ่ายชาย"
                  const dur = calculateSleepDuration(log.bedTime, log.wakeTime)
                  const evalSt = evaluateSleepStatus(
                    log.durationHours,
                    log.sleepGoalHours || 8,
                    log.bedTime,
                    log.quality
                  )
                  const isLate = isLateBedtime(log.bedTime, 23, 30)
                  return (
                    <TableRow
                      key={log.id}
                      className="border-[#26334d] hover:bg-slate-800/40"
                    >
                      <TableCell className="text-xs text-white font-medium whitespace-nowrap">
                        {formatThaiDate(log.date)}
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant="secondary"
                          className={`text-[10px] whitespace-nowrap ${
                            isMaleEntry
                              ? "bg-emerald-500/20 text-emerald-300 border-emerald-500/30"
                              : "bg-pink-500/20 text-pink-300 border-pink-500/30"
                          }`}
                        >
                          {isMaleEntry ? "🏋️‍♂️ ชาย" : "🧘‍♀️ หญิง"}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-center text-sm font-bold font-mono whitespace-nowrap">
                        <span className={isLate ? "text-rose-300" : "text-indigo-300"}>
                          {log.bedTime} น.
                        </span>
                        {isLate && (
                          <span className="block text-[9px] text-rose-400 font-sans">
                            นอนดึก
                          </span>
                        )}
                      </TableCell>
                      <TableCell className="text-center text-sm font-bold text-amber-300 font-mono whitespace-nowrap">
                        {log.wakeTime} น.
                      </TableCell>
                      <TableCell className="text-center text-sm font-extrabold text-white font-mono whitespace-nowrap">
                        {dur.formatted}
                      </TableCell>
                      <TableCell className="text-center font-mono">
                        <Badge
                          className={`text-[11px] font-bold ${
                            evalSt.energyScore >= 80
                              ? "bg-emerald-500/20 text-emerald-300 border-emerald-500/30"
                              : evalSt.energyScore >= 60
                              ? "bg-amber-500/20 text-amber-300 border-amber-500/30"
                              : "bg-rose-500/20 text-rose-300 border-rose-500/30"
                          }`}
                        >
                          {evalSt.energyScore}/100
                        </Badge>
                      </TableCell>
                      <TableCell className="text-xs text-slate-300 whitespace-nowrap">
                        {log.quality}
                      </TableCell>
                      <TableCell>
                        <Badge
                          className={`text-[10px] whitespace-nowrap ${evalSt.badgeClass}`}
                        >
                          {evalSt.label}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-xs text-slate-400 max-w-[160px] truncate">
                        {log.notes || "-"}
                      </TableCell>
                      <TableCell className="text-center">
                        <div className="flex items-center justify-center gap-1">
                          <button
                            onClick={() => onOpenAddSleep(log.date, log.person)}
                            className="p-1 rounded text-slate-400 hover:text-indigo-400 hover:bg-indigo-500/10 transition-colors"
                            title="แก้ไขบันทึกนี้"
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </button>
                          <button
                            onClick={() => handleDeleteLog(log.id, log.date, log.person)}
                            className="p-1 rounded text-slate-500 hover:text-rose-400 hover:bg-rose-500/10 transition-colors"
                            title="ลบบันทึกนี้"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </TableCell>
                    </TableRow>
                  )
                })
              )}
            </TableBody>
          </Table>
        </div>
      </Card>
    </div>
  )
}
