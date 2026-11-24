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
  WorkoutEntry,
  DailyStepLog,
  getWorkoutLogs,
  getDailyStepLogs,
  deleteWorkoutLog,
  calculateWorkoutStats,
} from "@/lib/exerciseDatabase"
import { getCalorieSettings } from "@/lib/calorieSettings"
import { formatThaiDate } from "@/lib/utils"
import {
  Activity,
  Footprints,
  Flame,
  Clock,
  Dumbbell,
  Plus,
  Trash2,
  Calendar,
  Navigation,
  Filter,
  CheckCircle2,
  Zap,
  ChevronLeft,
  ChevronRight,
} from "lucide-react"
import { toast } from "sonner"

interface WorkoutTrackerViewProps {
  selectedPerson?: string
  onSelectPerson?: (p: string) => void
  onOpenAddWorkout: () => void
  onOpenAddStep: () => void
}

type TimeRangeFilter = "7d" | "14d" | "30d" | "all"
type CategoryFilter = "all" | "cardio" | "weight" | "steps" | "stretch"

export function WorkoutTrackerView({
  selectedPerson = "ฝ่ายชาย",
  onSelectPerson,
  onOpenAddWorkout,
  onOpenAddStep,
}: WorkoutTrackerViewProps) {
  const [workouts, setWorkouts] = React.useState<WorkoutEntry[]>(getWorkoutLogs)
  const [stepLogs, setStepLogs] = React.useState<DailyStepLog[]>(getDailyStepLogs)
  const [personFilter, setPersonFilter] = React.useState<string>(selectedPerson)
  const [timeRange, setTimeRange] = React.useState<TimeRangeFilter>("30d")
  const [categoryFilter, setCategoryFilter] = React.useState<CategoryFilter>("all")
  const [filterDate, setFilterDate] = React.useState<string>("")

  const todayStr = new Date().toLocaleDateString("en-CA")
  const [stepCardDate, setStepCardDate] = React.useState<string>(todayStr)

  const calorieSettings = getCalorieSettings()
  const maleStepGoal = calorieSettings.male.stepGoal || 8000
  const femaleStepGoal = calorieSettings.female.stepGoal || 8000

  const reloadData = () => {
    setWorkouts(getWorkoutLogs())
    setStepLogs(getDailyStepLogs())
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
    if (onSelectPerson && (p === "ฝ่ายชาย" || p === "ฝ่ายหญิง" || p === "ALL")) {
      onSelectPerson(p)
    }
  }

  const handleDeleteWorkout = (id: string, name: string) => {
    if (window.confirm(`คุณต้องการลบบันทึก "${name}" ใช่หรือไม่?`)) {
      deleteWorkoutLog(id)
      reloadData()
      toast.success("ลบบันทึกการออกกำลังกายเรียบร้อยแล้ว")
    }
  }

  const handlePrevStepDay = () => {
    const cur = new Date(stepCardDate + "T12:00:00")
    cur.setDate(cur.getDate() - 1)
    setStepCardDate(cur.toLocaleDateString("en-CA"))
  }

  const handleNextStepDay = () => {
    const cur = new Date(stepCardDate + "T12:00:00")
    cur.setDate(cur.getDate() + 1)
    setStepCardDate(cur.toLocaleDateString("en-CA"))
  }

  const rangeStartDate = React.useMemo(() => {
    if (timeRange === "all") return undefined
    const days = timeRange === "7d" ? 6 : timeRange === "14d" ? 13 : 29
    const d = new Date()
    d.setDate(d.getDate() - days)
    return d.toLocaleDateString("en-CA")
  }, [timeRange])

  const matchCategory = (categoryStr: string, filter: CategoryFilter) => {
    if (filter === "all") return true
    const c = String(categoryStr || "")
    if (filter === "cardio") return c.includes("คาร์ดิโอ") || c.includes("Cardio")
    if (filter === "weight") return c.includes("เวทเทรนนิ่ง")
    if (filter === "steps") return c.includes("ก้าวเดิน")
    if (filter === "stretch") return c.includes("ยืดเหยียด") || c.includes("โยคะ")
    return true
  }

  // Filter workouts
  const filteredWorkouts = React.useMemo(() => {
    return workouts.filter((w) => {
      const matchPerson = personFilter === "ALL" || w.person === personFilter
      if (!matchPerson) return false
      if (filterDate) {
        if (w.date !== filterDate) return false
      } else if (rangeStartDate && w.date < rangeStartDate) {
        return false
      }
      return matchCategory(w.category, categoryFilter)
    })
  }, [workouts, personFilter, filterDate, rangeStartDate, categoryFilter])

  // Active date for Daily Step Card
  const activeStepDate = filterDate || stepCardDate

  const maleTodayStep = stepLogs.find(
    (s) => s.date === activeStepDate && s.person === "ฝ่ายชาย"
  )
  const femaleTodayStep = stepLogs.find(
    (s) => s.date === activeStepDate && s.person === "ฝ่ายหญิง"
  )

  const stats = React.useMemo(() => {
    const baseStats = calculateWorkoutStats(
      filteredWorkouts,
      stepLogs,
      filterDate || rangeStartDate,
      filterDate || todayStr,
      personFilter === "ALL" ? undefined : personFilter
    )

    const scopedSteps = stepLogs.filter((s) => {
      if (personFilter !== "ALL" && s.person !== personFilter) return false
      if (filterDate) return s.date === filterDate
      if (rangeStartDate && s.date < rangeStartDate) return false
      return true
    })

    const stepGoalHits = scopedSteps.filter((s) => {
      const g = s.stepGoal || (s.person === "ฝ่ายหญิง" ? femaleStepGoal : maleStepGoal)
      return Number(s.steps) >= g
    }).length

    return {
      ...baseStats,
      scopedStepsDays: scopedSteps.length,
      stepGoalHits,
      stepGoalHitPct:
        scopedSteps.length > 0 ? Math.round((stepGoalHits / scopedSteps.length) * 100) : 0,
    }
  }, [
    filteredWorkouts,
    stepLogs,
    filterDate,
    rangeStartDate,
    todayStr,
    personFilter,
    maleStepGoal,
    femaleStepGoal,
  ])

  return (
    <div className="space-y-6">
      {/* Top Header & Person Filter */}
      <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4 bg-gradient-to-r from-slate-900 via-[#151d2f] to-[#151d2f] border border-[#26334d] rounded-2xl p-6 shadow-lg">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2 flex-wrap">
            <Activity className="h-6 w-6 text-emerald-400" />
            <span>ระบบวิเคราะห์รูทีนการออกกำลังกาย & ก้าวเดิน</span>
            <Badge className="bg-emerald-500/20 text-emerald-300 border-emerald-500/30 text-xs">
              Active Routine & NEAT
            </Badge>
          </h1>
          <p className="text-slate-400 text-xs sm:text-sm mt-0.5">
            ติดตามความสม่ำเสมอของการขยับตัว (NEAT ก้าวเดิน) และการออกกำลังกาย เพื่อกระตุ้นระบบเผาผลาญและเพิ่มพลังงานระหว่างวัน
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {/* Person Toggle */}
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
            onClick={onOpenAddStep}
            variant="outline"
            className="border-indigo-500/40 text-indigo-300 hover:text-white hover:bg-indigo-600/20 text-xs h-9 px-3 flex items-center gap-1.5"
          >
            <Footprints className="h-4 w-4 text-indigo-400" />
            + บันทึกก้าวเดิน
          </Button>

          <Button
            onClick={onOpenAddWorkout}
            className="bg-emerald-600 hover:bg-emerald-500 text-white font-medium text-xs h-9 px-3 shadow-md shadow-emerald-950 flex items-center gap-1.5"
          >
            <Plus className="h-4 w-4" />
            + บันทึกออกกำลังกาย
          </Button>
        </div>
      </div>

      {/* 🔍 ADVANCED FILTER BAR (กรองช่วงเวลา & หมวดหมู่กิจกรรม) */}
      <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3 bg-[#111726] border border-[#26334d] p-3.5 rounded-2xl shadow-md">
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="text-xs text-slate-400 font-medium flex items-center gap-1 mr-1">
            <Calendar className="h-3.5 w-3.5 text-emerald-400" />
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
                  ? "bg-emerald-600 text-white font-semibold shadow-sm"
                  : "bg-[#0b0f19] text-slate-400 hover:text-white border border-[#26334d]"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="text-xs text-slate-400 font-medium flex items-center gap-1 mr-1">
            <Filter className="h-3.5 w-3.5 text-indigo-400" />
            ประเภทกิจกรรม:
          </span>
          {(
            [
              { key: "all", label: "ทั้งหมด" },
              { key: "cardio", label: "🏃 คาร์ดิโอ" },
              { key: "weight", label: "🏋️ เวทเทรนนิ่ง" },
              { key: "steps", label: "👟 ก้าวเดิน" },
              { key: "stretch", label: "🧘 ยืดเหยียด/โยคะ" },
            ] as { key: CategoryFilter; label: string }[]
          ).map((cf) => (
            <button
              key={cf.key}
              type="button"
              onClick={() => setCategoryFilter(cf.key)}
              className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-all ${
                categoryFilter === cf.key
                  ? "bg-indigo-600 text-white font-semibold shadow-sm"
                  : "bg-[#0b0f19] text-slate-400 hover:text-white border border-[#26334d]"
              }`}
            >
              {cf.label}
            </button>
          ))}
        </div>
      </div>

      {/* 📊 5 KEY ROUTINE ACTIVITY & ENERGY BURN METRICS */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        <Card className="bg-[#151d2f] border-[#26334d]">
          <CardContent className="p-3.5 space-y-1">
            <span className="text-[11px] text-slate-400 flex items-center justify-between">
              <span>วันที่มีการขยับตัว</span>
              <Zap className="h-3.5 w-3.5 text-emerald-400" />
            </span>
            <div className="text-xl font-extrabold text-white font-mono">
              {stats.daysActive} <span className="text-xs font-normal text-slate-400">วัน</span>
            </div>
            <span className="text-[10px] text-emerald-400 block">
              ออกกำลังกาย {stats.totalWorkouts} เซสชัน
            </span>
          </CardContent>
        </Card>

        <Card className="bg-[#151d2f] border-[#26334d]">
          <CardContent className="p-3.5 space-y-1">
            <span className="text-[11px] text-slate-400 flex items-center justify-between">
              <span>เวลาออกกำลังรวม</span>
              <Clock className="h-3.5 w-3.5 text-amber-400" />
            </span>
            <div className="text-xl font-extrabold text-amber-300 font-mono">
              {stats.totalWorkoutMinutes.toLocaleString()}{" "}
              <span className="text-xs font-normal text-slate-400">นาที</span>
            </div>
            <span className="text-[10px] text-slate-400 block">
              เฉลี่ย{" "}
              {stats.totalWorkouts > 0
                ? Math.round(stats.totalWorkoutMinutes / stats.totalWorkouts)
                : 0}{" "}
              นาที/ครั้ง
            </span>
          </CardContent>
        </Card>

        <Card className="bg-[#151d2f] border-[#26334d]">
          <CardContent className="p-3.5 space-y-1">
            <span className="text-[11px] text-slate-400 flex items-center justify-between">
              <span>เผาผลาญรวม (กิจกรรม+ก้าว)</span>
              <Flame className="h-3.5 w-3.5 text-orange-400" />
            </span>
            <div className="text-xl font-extrabold text-orange-400 font-mono">
              {stats.totalCombinedCalories.toLocaleString()}{" "}
              <span className="text-xs font-normal text-slate-400">kcal</span>
            </div>
            <span className="text-[10px] text-slate-400 block">
              เวท/คาร์ดิโอ {stats.totalWorkoutCalories.toLocaleString()} + ก้าว{" "}
              {stats.totalStepCalories.toLocaleString()}
            </span>
          </CardContent>
        </Card>

        <Card className="bg-[#151d2f] border-[#26334d]">
          <CardContent className="p-3.5 space-y-1">
            <span className="text-[11px] text-slate-400 flex items-center justify-between">
              <span>ก้าวเดินเฉลี่ยต่อวัน</span>
              <Footprints className="h-3.5 w-3.5 text-indigo-400" />
            </span>
            <div className="text-xl font-extrabold text-indigo-300 font-mono">
              {stats.avgStepsPerDay.toLocaleString()}{" "}
              <span className="text-xs font-normal text-slate-400">ก้าว</span>
            </div>
            <span className="text-[10px] text-slate-400 block">
              สะสมรวม {stats.totalSteps.toLocaleString()} ก้าว
            </span>
          </CardContent>
        </Card>

        <Card className="bg-[#151d2f] border-emerald-500/30">
          <CardContent className="p-3.5 space-y-1">
            <span className="text-[11px] text-emerald-300 flex items-center justify-between">
              <span>วันที่เดินครบเป้าหมาย</span>
              <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />
            </span>
            <div className="text-xl font-extrabold text-emerald-400 font-mono">
              {stats.stepGoalHits} / {stats.scopedStepsDays}{" "}
              <span className="text-xs font-normal text-slate-400">วัน</span>
            </div>
            <span className="text-[10px] text-slate-300 block">
              อัตราความสำเร็จ {stats.stepGoalHitPct}%
            </span>
          </CardContent>
        </Card>
      </div>

      {/* 🚶 DAILY STEP COUNT TRACKER WIDGET */}
      <Card className="bg-gradient-to-br from-[#111a2d] to-[#161d33] border-2 border-indigo-500/40 shadow-xl overflow-hidden">
        <CardHeader className="p-4 pb-3 border-b border-[#26334d] flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <CardTitle className="text-base font-bold text-white flex items-center gap-2">
              <Footprints className="h-5 w-5 text-indigo-400" />
              ตัวติดตามก้าวเดินประจำวัน (Daily Step & NEAT Tracker)
            </CardTitle>
            <CardDescription className="text-xs text-slate-400">
              ประจำวันที่ {formatThaiDate(activeStepDate)} (เป้าหมาย: ชาย{" "}
              {maleStepGoal.toLocaleString()} • หญิง {femaleStepGoal.toLocaleString()} ก้าว/วัน)
            </CardDescription>
          </div>

          <div className="flex items-center gap-1.5 flex-wrap">
            <Button
              variant="outline"
              size="sm"
              onClick={handlePrevStepDay}
              className="border-[#26334d] bg-[#0b0f19] text-slate-300 hover:text-white h-8 px-2"
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Input
              type="date"
              value={activeStepDate}
              onChange={(e) => {
                setStepCardDate(e.target.value)
                if (filterDate) setFilterDate(e.target.value)
              }}
              className="bg-[#0b0f19] border-[#26334d] text-white text-xs h-8 w-36 font-mono"
            />
            <Button
              variant="outline"
              size="sm"
              onClick={handleNextStepDay}
              className="border-[#26334d] bg-[#0b0f19] text-slate-300 hover:text-white h-8 px-2"
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
            <Button
              onClick={onOpenAddStep}
              size="sm"
              className="bg-indigo-600 hover:bg-indigo-500 text-white text-xs h-8 px-3 font-semibold shadow-md shadow-indigo-950 flex items-center gap-1.5"
            >
              <Footprints className="h-3.5 w-3.5" />
              + อัปเดตก้าวเดิน
            </Button>
          </div>
        </CardHeader>

        <CardContent className="p-4 sm:p-6 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Male Steps Box */}
            {(() => {
              const mGoal = maleTodayStep?.stepGoal || maleStepGoal
              const mPct = maleTodayStep
                ? Math.round((maleTodayStep.steps / mGoal) * 100)
                : 0
              return (
                <div className="p-4 rounded-xl bg-[#0b0f19] border border-emerald-500/30 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-bold text-white flex items-center gap-1.5">
                      <span>🏋️‍♂️</span> ฝ่ายชาย (Male)
                    </span>
                    <Badge
                      className={`text-[10px] ${
                        maleTodayStep
                          ? mPct >= 100
                            ? "bg-emerald-500/20 text-emerald-300 border-emerald-500/30"
                            : "bg-amber-500/20 text-amber-300 border-amber-500/30"
                          : "bg-slate-800 text-slate-400 border-slate-700"
                      }`}
                    >
                      {maleTodayStep ? `${mPct}% ของเป้า` : "ยังไม่บันทึก"}
                    </Badge>
                  </div>

                  <div className="flex items-baseline gap-2">
                    <span className="text-3xl font-extrabold text-white font-mono">
                      {maleTodayStep ? maleTodayStep.steps.toLocaleString() : "0"}
                    </span>
                    <span className="text-xs text-slate-400">
                      / {mGoal.toLocaleString()} ก้าว
                    </span>
                  </div>

                  <div className="w-full bg-slate-800 rounded-full h-2 overflow-hidden">
                    <div
                      className="bg-emerald-400 h-2 rounded-full transition-all duration-700"
                      style={{
                        width: `${Math.min(100, mPct)}%`,
                      }}
                    />
                  </div>

                  <div className="flex items-center justify-between text-xs text-slate-400 pt-1 border-t border-[#26334d]">
                    <span className="flex items-center gap-1">
                      <Navigation className="h-3 w-3 text-indigo-400" />~
                      {maleTodayStep
                        ? maleTodayStep.distanceKm ||
                          (maleTodayStep.steps * 0.00075).toFixed(1)
                        : "0"}{" "}
                      กม.
                    </span>
                    <span className="flex items-center gap-1 text-amber-300 font-mono">
                      <Flame className="h-3 w-3 text-orange-400" />~
                      {maleTodayStep ? maleTodayStep.burnedCalories : "0"} kcal
                    </span>
                  </div>
                </div>
              )
            })()}

            {/* Female Steps Box */}
            {(() => {
              const fGoal = femaleTodayStep?.stepGoal || femaleStepGoal
              const fPct = femaleTodayStep
                ? Math.round((femaleTodayStep.steps / fGoal) * 100)
                : 0
              return (
                <div className="p-4 rounded-xl bg-[#0b0f19] border border-pink-500/30 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-bold text-white flex items-center gap-1.5">
                      <span>🧘‍♀️</span> ฝ่ายหญิง (Female)
                    </span>
                    <Badge
                      className={`text-[10px] ${
                        femaleTodayStep
                          ? fPct >= 100
                            ? "bg-emerald-500/20 text-emerald-300 border-emerald-500/30"
                            : "bg-pink-500/20 text-pink-300 border-pink-500/30"
                          : "bg-slate-800 text-slate-400 border-slate-700"
                      }`}
                    >
                      {femaleTodayStep ? `${fPct}% ของเป้า` : "ยังไม่บันทึก"}
                    </Badge>
                  </div>

                  <div className="flex items-baseline gap-2">
                    <span className="text-3xl font-extrabold text-white font-mono">
                      {femaleTodayStep ? femaleTodayStep.steps.toLocaleString() : "0"}
                    </span>
                    <span className="text-xs text-slate-400">
                      / {fGoal.toLocaleString()} ก้าว
                    </span>
                  </div>

                  <div className="w-full bg-slate-800 rounded-full h-2 overflow-hidden">
                    <div
                      className="bg-pink-400 h-2 rounded-full transition-all duration-700"
                      style={{
                        width: `${Math.min(100, fPct)}%`,
                      }}
                    />
                  </div>

                  <div className="flex items-center justify-between text-xs text-slate-400 pt-1 border-t border-[#26334d]">
                    <span className="flex items-center gap-1">
                      <Navigation className="h-3 w-3 text-pink-400" />~
                      {femaleTodayStep
                        ? femaleTodayStep.distanceKm ||
                          (femaleTodayStep.steps * 0.00075).toFixed(1)
                        : "0"}{" "}
                      กม.
                    </span>
                    <span className="flex items-center gap-1 text-amber-300 font-mono">
                      <Flame className="h-3 w-3 text-orange-400" />~
                      {femaleTodayStep ? femaleTodayStep.burnedCalories : "0"} kcal
                    </span>
                  </div>
                </div>
              )
            })()}
          </div>
        </CardContent>
      </Card>

      {/* Workout History Table */}
      <Card className="bg-[#151d2f] border-[#26334d] overflow-hidden">
        <CardHeader className="p-4 pb-3 border-b border-[#26334d] flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <CardTitle className="text-base font-semibold text-white flex items-center gap-2">
              <Dumbbell className="h-4 w-4 text-emerald-400" />
              ประวัติการออกกำลังกายที่บันทึกไว้ ({filteredWorkouts.length} รายการ)
            </CardTitle>
            <CardDescription className="text-xs text-slate-400">
              ข้อมูลที่เชื่อมโยงและจดบันทึกลงในสเปรดชีต Google (B หน้าจดบันทึก)
            </CardDescription>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <Input
              type="date"
              value={filterDate}
              onChange={(e) => setFilterDate(e.target.value)}
              className="bg-[#0b0f19] border-[#26334d] text-white text-xs h-8 w-36"
              placeholder="กรองตามวันที่"
            />
            {(filterDate || categoryFilter !== "all" || timeRange !== "30d") && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setFilterDate("")
                  setCategoryFilter("all")
                  setTimeRange("30d")
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
                <TableHead className="text-slate-300">ท่า / กิจกรรม</TableHead>
                <TableHead className="text-slate-300">หมวดหมู่</TableHead>
                <TableHead className="text-center text-slate-300">เวลา (นาที)</TableHead>
                <TableHead className="text-right text-orange-400 font-semibold">เผาผลาญ (kcal)</TableHead>
                <TableHead className="text-slate-300">เซ็ต / น้ำหนัก / ระยะทาง</TableHead>
                <TableHead className="text-slate-300">ก้าวเดิน</TableHead>
                <TableHead className="text-slate-300">บันทึก</TableHead>
                <TableHead className="w-10 text-center text-slate-400">ลบ</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredWorkouts.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={10} className="text-center py-10 text-slate-400">
                    ยังไม่มีข้อมูลบันทึกการออกกำลังกายสำหรับตัวกรองนี้
                  </TableCell>
                </TableRow>
              ) : (
                filteredWorkouts.map((w) => {
                  const isMaleEntry = w.person === "ฝ่ายชาย"
                  return (
                    <TableRow key={w.id} className="border-[#26334d] hover:bg-slate-800/40">
                      <TableCell className="text-xs text-white font-medium whitespace-nowrap">
                        {formatThaiDate(w.date)}
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
                      <TableCell className="font-semibold text-white text-sm whitespace-nowrap">
                        {w.exerciseName}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="text-[10px] bg-slate-800 text-slate-300 border-slate-700 whitespace-nowrap">
                          {w.category}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-center text-xs font-mono text-white">
                        {w.durationMinutes}
                      </TableCell>
                      <TableCell className="text-right text-sm font-bold text-orange-400 font-mono whitespace-nowrap">
                        {w.burnedCalories}
                      </TableCell>
                      <TableCell className="text-xs text-slate-300 whitespace-nowrap">
                        {w.sets && w.reps ? (
                          <span>
                            {w.sets} เซ็ต × {w.reps} ครั้ง {w.weightKg ? `(${w.weightKg} kg)` : ""}
                          </span>
                        ) : w.distanceKm ? (
                          <span>{w.distanceKm} กม.</span>
                        ) : (
                          "-"
                        )}
                      </TableCell>
                      <TableCell className="text-xs text-indigo-300 font-mono whitespace-nowrap">
                        {w.steps ? `${w.steps.toLocaleString()} ก้าว` : "-"}
                      </TableCell>
                      <TableCell className="text-xs text-slate-400 max-w-[150px] truncate">
                        {w.notes || "-"}
                      </TableCell>
                      <TableCell className="text-center">
                        <button
                          onClick={() => handleDeleteWorkout(w.id, w.exerciseName)}
                          className="p-1 rounded text-slate-500 hover:text-rose-400 hover:bg-rose-500/10 transition-colors"
                          title="ลบบันทึกนี้"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
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
