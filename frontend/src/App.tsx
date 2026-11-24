import * as React from "react"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import { Toaster, toast } from "sonner"
import {
  callGasApi,
  getSavedPasscode,
  setSavedPasscode,
} from "@/api/gasClient"
import { PasscodeGate } from "@/components/views/PasscodeGate"
import { DashboardView } from "@/components/views/DashboardView"
import { CalendarView } from "@/components/views/CalendarView"
import { MealPlanView } from "@/components/views/MealPlanView"
import { FoodDatabaseView } from "@/components/views/FoodDatabaseView"
import { WeightTrackerView } from "@/components/views/WeightTrackerView"
import { ExerciseDatabaseView } from "@/components/views/ExerciseDatabaseView"
import { WorkoutTrackerView } from "@/components/views/WorkoutTrackerView"
import { SleepTrackerView } from "@/components/views/SleepTrackerView"
import { SheetSyncView } from "@/components/views/SheetSyncView"
import { SettingsView } from "@/components/views/SettingsView"
import { AddMealModal } from "@/components/modals/AddMealModal"
import { AddFoodModal } from "@/components/modals/AddFoodModal"
import { AddWeightModal } from "@/components/modals/AddWeightModal"
import { AddWorkoutModal } from "@/components/modals/AddWorkoutModal"
import { AddStepModal } from "@/components/modals/AddStepModal"
import { AddSleepModal } from "@/components/modals/AddSleepModal"
import { ExerciseItem, saveAllWorkoutLogs, saveAllStepLogs } from "@/lib/exerciseDatabase"
import { saveAllSleepLogs } from "@/lib/sleepTracker"
import { saveCalorieSettings } from "@/lib/calorieSettings"
import { saveProjects } from "@/lib/projectManager"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  LayoutDashboard,
  CalendarCheck,
  CalendarDays,
  Utensils,
  Scale,
  Dumbbell,
  Activity,
  Moon,
  FileSpreadsheet,
  Settings,
  Menu,
  X,
  LogOut,
  RefreshCw,
  Plus,
  ExternalLink,
} from "lucide-react"

type ViewKey =
  | "dashboard"
  | "calendar"
  | "mealplan"
  | "fooddb"
  | "weight"
  | "exercisedb"
  | "workout"
  | "sleep"
  | "sheetsync"
  | "settings"

const STORAGE_FOODS_CACHE_KEY = "finess_cached_foods"

function getCachedFoods(): any[] {
  try {
    const raw = localStorage.getItem(STORAGE_FOODS_CACHE_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

function saveCachedFoods(foods: any[]) {
  try {
    if (Array.isArray(foods) && foods.length > 0) {
      localStorage.setItem(STORAGE_FOODS_CACHE_KEY, JSON.stringify(foods))
    }
  } catch {}
}

export default function App() {
  const queryClient = useQueryClient()
  const [passcode, setPasscode] = React.useState<string>(getSavedPasscode())
  const [currentView, setCurrentView] = React.useState<ViewKey>("dashboard")
  const [mobileMenuOpen, setMobileMenuOpen] = React.useState(false)
  const [selectedPerson, setSelectedPerson] = React.useState<string>("ฝ่ายชาย")

  // Modals state
  const [addMealOpen, setAddMealOpen] = React.useState(false)
  const [addFoodOpen, setAddFoodOpen] = React.useState(false)
  const [addWeightOpen, setAddWeightOpen] = React.useState(false)
  const [addWorkoutOpen, setAddWorkoutOpen] = React.useState(false)
  const [addStepOpen, setAddStepOpen] = React.useState(false)
  const [addSleepOpen, setAddSleepOpen] = React.useState(false)
  const [selectedExerciseForLog, setSelectedExerciseForLog] = React.useState<ExerciseItem | null>(null)
  const [selectedFoodForMeal, setSelectedFoodForMeal] = React.useState<any>(null)
  const [selectedDateForMeal, setSelectedDateForMeal] = React.useState<string>("")
  const [selectedDateForSleep, setSelectedDateForSleep] = React.useState<string>("")
  const [selectedPersonForSleep, setSelectedPersonForSleep] = React.useState<string>("")

  // Auto-check for new deployed web bundle on tab focus & interval
  React.useEffect(() => {
    const checkAppVersion = async () => {
      try {
        const res = await fetch("./?_ts=" + Date.now(), { cache: "no-store" })
        const html = await res.text()
        const match = html.match(/src=["']\.\/assets\/(index-[^"']+\.js)["']/)
        if (match && match[1]) {
          const loadedScript = document.querySelector('script[src*="index-"]') as HTMLScriptElement
          if (loadedScript && loadedScript.src && !loadedScript.src.includes(match[1])) {
            toast.info("✨ มีเวอร์ชันใหม่ (ระบบคูณเสิร์ฟอาหาร) พร้อมใช้งานแล้ว!", {
              description: "แตะปุ่มนี้เพื่อโหลดเวอร์ชันล่าสุด",
              action: {
                label: "🔄 โหลดเวอร์ชันใหม่",
                onClick: () => {
                  window.location.reload()
                },
              },
              duration: 30000,
            })
          }
        }
      } catch (err) {
        // ignore
      }
    }

    const timer = setTimeout(checkAppVersion, 2000)
    window.addEventListener("focus", checkAppVersion)
    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "visible") checkAppVersion()
    })
    return () => {
      clearTimeout(timer)
      window.removeEventListener("focus", checkAppVersion)
    }
  }, [])

  // Fetch initial data from GAS Backend
  const {
    data: initialData,
    isLoading,
    isRefetching,
    refetch,
    error,
  } = useQuery({
    queryKey: ["initialData", passcode],
    queryFn: async () => {
      const data = await callGasApi<{
        spreadsheetName: string
        meals: any[]
        foods: any[]
        healthLogs: any[]
        rawSheets: any[]
        calorieSettings?: any
        projects?: any[]
        workoutLogs?: any[]
        stepLogs?: any[]
        sleepLogs?: any[]
      }>("GET_INITIAL_DATA")

      // Sync cloud settings, projects, and workouts across all devices
      if (data?.calorieSettings) {
        saveCalorieSettings(data.calorieSettings)
      }
      if (data?.projects && Array.isArray(data.projects)) {
        saveProjects(data.projects)
      }
      if (data?.workoutLogs && Array.isArray(data.workoutLogs)) {
        saveAllWorkoutLogs(data.workoutLogs)
      }
      if (data?.stepLogs && Array.isArray(data.stepLogs)) {
        saveAllStepLogs(data.stepLogs)
      }
      if (data?.sleepLogs && Array.isArray(data.sleepLogs)) {
        saveAllSleepLogs(data.sleepLogs)
      }
      if (data?.foods && Array.isArray(data.foods) && data.foods.length > 0) {
        saveCachedFoods(data.foods)
      }

      return data
    },
    enabled: !!passcode,
    retry: 1,
  })

  // Handle logout
  const handleLogout = () => {
    setSavedPasscode("")
    setPasscode("")
    toast.info("ออกจากระบบแล้ว")
  }

  // Handle add meal (supports both single meal and batch array of meals)
  const handleSaveMeal = async (newMeal: any) => {
    if (Array.isArray(newMeal)) {
      for (const m of newMeal) {
        await callGasApi("ADD_MEAL", m)
      }
    } else {
      await callGasApi("ADD_MEAL", newMeal)
    }
    await refetch()
  }

  // Handle toggle meal status
  const handleToggleMealStatus = async (id: string, currentStatus: string) => {
    toast.info("รายการนี้ถูกบันทึกในชีตเรียบร้อยแล้ว")
  }

  // Handle delete meal
  const handleDeleteMeal = async (id: string) => {
    try {
      toast.loading("กำลังลบรายการอาหารจาก Google Sheets...", { id: "delete-meal" })
      await callGasApi("DELETE_MEAL", { id })
      toast.success("ลบรายการอาหารออกจากชีตเรียบร้อยแล้ว", { id: "delete-meal" })
      await refetch()
    } catch (err: any) {
      toast.error(err.message || "เกิดข้อผิดพลาดในการลบรายการอาหาร", { id: "delete-meal" })
    }
  }

  // Handle add food item
  const handleSaveFood = async (newFood: any) => {
    await callGasApi("ADD_FOOD_ITEM", newFood)
    await refetch()
  }

  // Handle add weight log
  const handleSaveWeight = async (newWeight: any) => {
    await callGasApi("ADD_WEIGHT_LOG", newWeight)
    await refetch()
  }

  // Quick add from food database to today's meal plan
  const handleQuickAddMealFromFood = (food: any) => {
    setSelectedFoodForMeal(food)
    setAddMealOpen(true)
  }

  // Data from GAS (with local cache fallback for foods so search never disappears)
  const meals = initialData?.meals || []
  const foods =
    initialData?.foods && initialData.foods.length > 0
      ? initialData.foods
      : getCachedFoods()
  const healthLogs = initialData?.healthLogs || []
  const rawSheets = initialData?.rawSheets || []

  // If not authenticated with passcode
  if (!passcode) {
    return (
      <>
        <Toaster position="top-right" richColors />
        <PasscodeGate
          onAuthenticated={(code) => {
            setSavedPasscode(code)
            setPasscode(code)
          }}
        />
      </>
    )
  }

  // Navigation Items
  const navItems: { key: ViewKey; label: string; icon: React.ReactNode; badge?: string }[] = [
    { key: "dashboard", label: "ภาพรวมโภชนาการ", icon: <LayoutDashboard className="h-4 w-4" /> },
    {
      key: "calendar",
      label: "ปฏิทินความสำเร็จ (ดี/ร้าย)",
      icon: <CalendarCheck className="h-4 w-4 text-emerald-400" />,
      badge: "ใหม่",
    },
    {
      key: "mealplan",
      label: "แผนการกิน",
      icon: <CalendarDays className="h-4 w-4" />,
      badge: meals.length > 0 ? `${meals.length}` : undefined,
    },
    {
      key: "fooddb",
      label: "คลังข้อมูลอาหาร",
      icon: <Utensils className="h-4 w-4" />,
      badge: foods.length > 0 ? `${foods.length}` : undefined,
    },
    {
      key: "weight",
      label: "บันทึกน้ำหนัก",
      icon: <Scale className="h-4 w-4" />,
      badge: healthLogs.length > 0 ? `${healthLogs.length} วัน` : undefined,
    },
    {
      key: "exercisedb",
      label: "คลังออกกำลังกาย",
      icon: <Dumbbell className="h-4 w-4" />,
    },
    {
      key: "workout",
      label: "บันทึกออกกำลังกาย / ก้าว",
      icon: <Activity className="h-4 w-4" />,
    },
    {
      key: "sleep",
      label: "บันทึกเวลานอน / ตื่น",
      icon: <Moon className="h-4 w-4 text-sky-400" />,
      badge: "ใหม่",
    },
    {
      key: "sheetsync",
      label: "Google Sheets",
      icon: <FileSpreadsheet className="h-4 w-4" />,
      badge: rawSheets.length > 0 ? `${rawSheets.length} แท็บ` : undefined,
    },
    { key: "settings", label: "ตั้งค่าระบบ", icon: <Settings className="h-4 w-4" /> },
  ]

  return (
    <div className="min-h-screen bg-[#0b0f19] text-slate-100 flex flex-col font-sans">
      <Toaster position="top-right" richColors />

      {/* Top Navigation Bar */}
      <header className="h-16 border-b border-[#26334d] bg-[#111726]/80 backdrop-blur-md sticky top-0 z-40 px-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="md:hidden p-2 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800"
          >
            {mobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>

          <div
            onClick={() => setCurrentView("dashboard")}
            className="flex items-center gap-2.5 cursor-pointer"
          >
            <div className="h-9 w-9 rounded-xl bg-gradient-to-tr from-emerald-600 to-teal-400 flex items-center justify-center text-white shadow-md shadow-emerald-950 font-bold text-lg">
              🥗
            </div>
            <div>
              <span className="font-bold text-base text-white tracking-tight flex items-center gap-1.5">
                แผนการกิน <span className="text-emerald-400 text-xs font-normal">Finess Meal</span>
                <Badge className="text-[9px] px-1.5 py-0 bg-emerald-500/20 text-emerald-300 border-emerald-500/30">
                  Couple Health
                </Badge>
              </span>
              <span className="text-[10px] text-slate-400 block -mt-0.5">
                Google Sheets & Apps Script Real-Time Sync
              </span>
            </div>
          </div>
        </div>

        {/* Top Right Controls */}
        <div className="flex items-center gap-2 sm:gap-3">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => refetch()}
            disabled={isRefetching || isLoading}
            className="h-8 px-2.5 text-xs text-slate-300 hover:text-white hover:bg-slate-800 border border-[#26334d]"
          >
            <RefreshCw
              className={`h-3.5 w-3.5 mr-1.5 ${isRefetching || isLoading ? "animate-spin text-emerald-400" : ""}`}
            />
            <span className="hidden sm:inline">ซิงค์ชีต</span>
          </Button>

          <Button
            size="sm"
            onClick={() => {
              setSelectedFoodForMeal(null)
              setAddMealOpen(true)
            }}
            className="h-8 px-3 text-xs bg-emerald-600 hover:bg-emerald-500 text-white font-medium flex items-center gap-1"
          >
            <Plus className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">บันทึกมื้อ</span>
          </Button>

          <Button
            variant="ghost"
            size="sm"
            onClick={handleLogout}
            className="h-8 w-8 p-0 text-slate-400 hover:text-rose-400 hover:bg-rose-500/10"
            title="ออกจากระบบ"
          >
            <LogOut className="h-4 w-4" />
          </Button>
        </div>
      </header>

      {/* Main App Layout */}
      <div className="flex-1 flex overflow-hidden">
        {/* Desktop Sidebar */}
        <aside className="hidden md:flex flex-col w-64 border-r border-[#26334d] bg-[#111726] p-4 shrink-0 justify-between">
          <div className="space-y-1">
            <div className="text-[11px] font-semibold text-slate-500 uppercase px-3 py-1.5">
              เมนูหลัก (Navigation)
            </div>
            {navItems.map((item) => (
              <button
                key={item.key}
                onClick={() => setCurrentView(item.key)}
                className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-sm font-medium transition-colors ${
                  currentView === item.key
                    ? "bg-emerald-600 text-white shadow-md shadow-emerald-950 font-semibold"
                    : "text-slate-400 hover:text-white hover:bg-slate-800/60"
                }`}
              >
                <div className="flex items-center gap-3">
                  {item.icon}
                  <span>{item.label}</span>
                </div>
                {item.badge && (
                  <Badge
                    variant="secondary"
                    className={`text-[10px] px-1.5 py-0 ${
                      currentView === item.key
                        ? "bg-emerald-700 text-emerald-100"
                        : "bg-slate-800 text-slate-400"
                    }`}
                  >
                    {item.badge}
                  </Badge>
                )}
              </button>
            ))}
          </div>

          {/* Sidebar Footer Link */}
          <div className="pt-4 border-t border-[#26334d]/60 space-y-2">
            <a
              href="https://docs.google.com/spreadsheets/d/1yP5DwepfHxGoP0_OYx3zTXZTEdijbIt0aQj_1wTPuGs/edit?gid=1001#gid=1001"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-between text-xs text-slate-400 hover:text-emerald-400 p-2 rounded-lg hover:bg-slate-800/40 transition-colors"
            >
              <div className="flex items-center gap-2">
                <FileSpreadsheet className="h-4 w-4 text-emerald-500" />
                <span>Google Sheets</span>
              </div>
              <ExternalLink className="h-3 w-3" />
            </a>

            <div className="text-[10px] text-slate-500 px-2">
              GitHub Pages • finess888.github.io
            </div>
          </div>
        </aside>

        {/* Mobile Slide-over Menu */}
        {mobileMenuOpen && (
          <div className="md:hidden fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex">
            <div className="w-64 bg-[#111726] border-r border-[#26334d] h-full p-4 flex flex-col justify-between">
              <div className="space-y-1">
                <div className="flex items-center justify-between pb-3 border-b border-[#26334d] mb-2">
                  <span className="font-bold text-white text-sm">เมนูระบบ</span>
                  <button onClick={() => setMobileMenuOpen(false)} className="text-slate-400">
                    <X className="h-5 w-5" />
                  </button>
                </div>
                {navItems.map((item) => (
                  <button
                    key={item.key}
                    onClick={() => {
                      setCurrentView(item.key)
                      setMobileMenuOpen(false)
                    }}
                    className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-sm font-medium transition-colors ${
                      currentView === item.key
                        ? "bg-emerald-600 text-white font-semibold"
                        : "text-slate-400 hover:text-white hover:bg-slate-800/60"
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      {item.icon}
                      <span>{item.label}</span>
                    </div>
                    {item.badge && (
                      <Badge variant="secondary" className="text-[10px]">
                        {item.badge}
                      </Badge>
                    )}
                  </button>
                ))}
              </div>

              <div className="pt-4 border-t border-[#26334d] text-xs text-slate-500">
                แผนการกิน v1.0.0
              </div>
            </div>
            <div className="flex-1" onClick={() => setMobileMenuOpen(false)} />
          </div>
        )}

        {/* Main Content Area */}
        <main className="flex-1 overflow-y-auto p-4 md:p-8 pb-24 md:pb-8">
          {currentView === "dashboard" && (
            <DashboardView
              meals={meals}
              foods={foods}
              healthLogs={healthLogs}
              selectedPerson={selectedPerson}
              onSelectPerson={setSelectedPerson}
              onOpenAddMeal={(date) => {
                setSelectedFoodForMeal(null)
                setSelectedDateForMeal(date || "")
                setAddMealOpen(true)
              }}
              onOpenAddWeight={() => setAddWeightOpen(true)}
              onOpenAddStep={() => setAddStepOpen(true)}
              onOpenAddSleep={(date, person) => {
                setSelectedDateForSleep(date || "")
                setSelectedPersonForSleep(person || "")
                setAddSleepOpen(true)
              }}
              onToggleMealStatus={handleToggleMealStatus}
              onNavigateToMealPlan={() => setCurrentView("mealplan")}
              onNavigateToCalendar={() => setCurrentView("calendar")}
              onNavigateToSleep={() => setCurrentView("sleep")}
            />
          )}

          {currentView === "calendar" && (
            <CalendarView
              meals={meals}
              foods={foods}
              healthLogs={healthLogs}
              selectedPerson={selectedPerson}
              onSelectPerson={setSelectedPerson}
              onOpenAddMeal={(date, person) => {
                setSelectedFoodForMeal(null)
                setSelectedDateForMeal(date || "")
                if (person) setSelectedPerson(person)
                setAddMealOpen(true)
              }}
              onOpenAddStep={() => setAddStepOpen(true)}
              onOpenAddWeight={() => setAddWeightOpen(true)}
              onOpenAddSleep={(date, person) => {
                setSelectedDateForSleep(date || "")
                setSelectedPersonForSleep(person || "")
                setAddSleepOpen(true)
              }}
            />
          )}

          {currentView === "mealplan" && (
            <MealPlanView
              meals={meals}
              selectedPerson={selectedPerson}
              onSelectPerson={setSelectedPerson}
              onOpenAddMeal={() => {
                setSelectedFoodForMeal(null)
                setAddMealOpen(true)
              }}
              onToggleMealStatus={handleToggleMealStatus}
              onDeleteMeal={handleDeleteMeal}
            />
          )}

          {currentView === "fooddb" && (
            <FoodDatabaseView
              foods={foods}
              onOpenAddFood={() => setAddFoodOpen(true)}
              onQuickAddMeal={handleQuickAddMealFromFood}
            />
          )}

          {currentView === "weight" && (
            <WeightTrackerView
              healthLogs={healthLogs}
              onOpenAddWeight={() => setAddWeightOpen(true)}
            />
          )}

          {currentView === "exercisedb" && (
            <ExerciseDatabaseView
              onQuickLogWorkout={(exercise) => {
                setSelectedExerciseForLog(exercise)
                setAddWorkoutOpen(true)
              }}
              onOpenAddWorkout={() => {
                setSelectedExerciseForLog(null)
                setAddWorkoutOpen(true)
              }}
            />
          )}

          {currentView === "workout" && (
            <WorkoutTrackerView
              selectedPerson={selectedPerson}
              onOpenAddWorkout={() => {
                setSelectedExerciseForLog(null)
                setAddWorkoutOpen(true)
              }}
              onOpenAddStep={() => setAddStepOpen(true)}
            />
          )}

          {currentView === "sleep" && (
            <SleepTrackerView
              selectedPerson={selectedPerson}
              onSelectPerson={setSelectedPerson}
              meals={meals}
              onOpenAddSleep={(date, person) => {
                setSelectedDateForSleep(date || "")
                setSelectedPersonForSleep(person || "")
                setAddSleepOpen(true)
              }}
            />
          )}

          {currentView === "sheetsync" && (
            <SheetSyncView
              rawSheets={rawSheets}
              spreadsheetName={initialData?.spreadsheetName}
              onRefresh={() => refetch()}
              loading={isRefetching || isLoading}
            />
          )}

          {currentView === "settings" && <SettingsView onLogout={handleLogout} />}
        </main>

        {/* Mobile Bottom Navigation Bar (Thumb-reachable) */}
        <nav className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-[#111726]/95 backdrop-blur-lg border-t border-[#26334d] px-2 py-1.5 flex items-center justify-around shadow-2xl safe-area-bottom">
          <button
            onClick={() => setCurrentView("dashboard")}
            className={`flex flex-col items-center gap-0.5 py-1 px-2 rounded-xl transition-all ${
              currentView === "dashboard"
                ? "text-emerald-400 font-bold"
                : "text-slate-400 hover:text-white"
            }`}
          >
            <LayoutDashboard className="h-4 w-4" />
            <span className="text-[10px]">ภาพรวม</span>
          </button>

          <button
            onClick={() => setCurrentView("calendar")}
            className={`flex flex-col items-center gap-0.5 py-1 px-2 rounded-xl transition-all ${
              currentView === "calendar"
                ? "text-emerald-400 font-bold"
                : "text-slate-400 hover:text-white"
            }`}
          >
            <CalendarCheck className="h-4 w-4" />
            <span className="text-[10px]">ปฏิทิน</span>
          </button>

          {/* Center Elevated Action Button */}
          <button
            onClick={() => {
              setSelectedFoodForMeal(null)
              setSelectedDateForMeal("")
              setAddMealOpen(true)
            }}
            className="flex flex-col items-center -mt-5 group"
            title="เพิ่มมื้ออาหาร"
          >
            <div className="h-11 w-11 rounded-full bg-gradient-to-tr from-emerald-600 to-teal-400 flex items-center justify-center text-white shadow-lg shadow-emerald-950/60 group-hover:scale-105 transition-transform border-2 border-[#111726]">
              <Plus className="h-6 w-6 stroke-[2.5]" />
            </div>
            <span className="text-[9px] text-emerald-300 font-semibold mt-0.5">จดมื้ออาหาร</span>
          </button>

          <button
            onClick={() => setCurrentView("mealplan")}
            className={`flex flex-col items-center gap-0.5 py-1 px-2 rounded-xl transition-all ${
              currentView === "mealplan"
                ? "text-emerald-400 font-bold"
                : "text-slate-400 hover:text-white"
            }`}
          >
            <CalendarDays className="h-4 w-4" />
            <span className="text-[10px]">มื้ออาหาร</span>
          </button>

          <button
            onClick={() => setMobileMenuOpen(true)}
            className="flex flex-col items-center gap-0.5 py-1 px-2 rounded-xl text-slate-400 hover:text-white transition-all"
          >
            <Menu className="h-4 w-4" />
            <span className="text-[10px]">เมนูอื่น</span>
          </button>
        </nav>
      </div>

      {/* Modals */}
      <AddMealModal
        open={addMealOpen}
        onOpenChange={(isOpen) => {
          setAddMealOpen(isOpen)
          if (!isOpen) {
            setSelectedFoodForMeal(null)
            setSelectedDateForMeal("")
          }
        }}
        onSave={handleSaveMeal}
        foods={foods}
        defaultPerson={selectedPerson === "ALL" ? "ฝ่ายชาย" : selectedPerson}
        initialFood={selectedFoodForMeal}
        initialDate={selectedDateForMeal}
      />

      <AddFoodModal
        open={addFoodOpen}
        onOpenChange={setAddFoodOpen}
        onSave={handleSaveFood}
      />

      <AddWeightModal
        open={addWeightOpen}
        onOpenChange={setAddWeightOpen}
        onSave={handleSaveWeight}
        defaultPerson={selectedPerson === "ALL" ? "ฝ่ายชาย" : selectedPerson}
      />

      <AddWorkoutModal
        open={addWorkoutOpen}
        onOpenChange={setAddWorkoutOpen}
        defaultPerson={selectedPerson === "ALL" ? "ฝ่ายชาย" : selectedPerson}
        defaultExercise={selectedExerciseForLog}
        onSaved={() => refetch()}
      />

      <AddStepModal
        open={addStepOpen}
        onOpenChange={setAddStepOpen}
        defaultPerson={selectedPerson === "ALL" ? "ฝ่ายชาย" : selectedPerson}
        onSaved={() => refetch()}
      />

      <AddSleepModal
        open={addSleepOpen}
        onOpenChange={(isOpen) => {
          setAddSleepOpen(isOpen)
          if (!isOpen) {
            setSelectedDateForSleep("")
            setSelectedPersonForSleep("")
          }
        }}
        defaultPerson={
          selectedPersonForSleep || (selectedPerson === "ALL" ? "ฝ่ายชาย" : selectedPerson)
        }
        initialDate={selectedDateForSleep}
        onSaved={() => refetch()}
      />
    </div>
  )
}
