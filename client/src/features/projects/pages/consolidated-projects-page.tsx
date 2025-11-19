import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/shared/components/ui/tabs";
import { useTenant } from "@/shared/hooks/useTenant";
import { useAuth } from "@/shared/hooks/useAuth";
import { useQueryTabState } from "@/shared/hooks/useQueryTabState";

// Import existing project page components
import Projects from "@/features/projects/pages/projects-page";
import ProjectReports from "@/features/reports/pages/project-reports-page";
import TimeTracking from "@/features/projects/pages/time-tracking-page";
import Timesheets from "@/features/projects/pages/timesheets-page";

export default function ConsolidatedProjects() {
  const { currentTenant } = useTenant();
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  const [activeTab, setActiveTab] = useQueryTabState("projects");

  if (!authLoading && !isAuthenticated) {
    setTimeout(() => {
      window.location.href = "/api/login";
    }, 500);
  }

  if (!currentTenant) {
    return (
      <div className="flex flex-col items-center justify-center h-[calc(100vh-4rem)] gap-4">
        <div className="text-center">
          <h2 className="text-2xl font-semibold text-gray-900 dark:text-white mb-2">
            No Workspace Selected
          </h2>
          <p className="text-gray-500 dark:text-gray-400">
            Please select or create a workspace to continue
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6" data-testid="projects-page">
      <div className="mb-6">
        <h1 className="text-3xl font-semibold text-gray-900 dark:text-white mb-2">
          Projects & Time Tracking
        </h1>
        <p className="text-gray-500 dark:text-gray-400">
          Manage projects, track time, and view profitability reports
        </p>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="mb-6">
          <TabsTrigger value="projects" data-testid="tab-projects">Projects</TabsTrigger>
          <TabsTrigger value="reports" data-testid="tab-project-reports">Project Reports</TabsTrigger>
          <TabsTrigger value="time-tracking" data-testid="tab-time-tracking">Time Tracking</TabsTrigger>
          <TabsTrigger value="timesheets" data-testid="tab-timesheets">Timesheets</TabsTrigger>
        </TabsList>

        <TabsContent value="projects" data-testid="content-projects">
          <Projects />
        </TabsContent>

        <TabsContent value="reports" data-testid="content-project-reports">
          <ProjectReports />
        </TabsContent>

        <TabsContent value="time-tracking" data-testid="content-time-tracking">
          <TimeTracking />
        </TabsContent>

        <TabsContent value="timesheets" data-testid="content-timesheets">
          <Timesheets />
        </TabsContent>
      </Tabs>
    </div>
  );
}
