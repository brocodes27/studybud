import { Navigate, Route, Routes, useSearchParams } from "react-router-dom";

import { lazy } from 'react';

const AddCourse = lazy(() => import("./AddCourse").then(m => ({ default: m.AddCourse })));
const CourseDetail = lazy(() => import("./CourseDetail").then(m => ({ default: m.CourseDetail })));
const CourseTracker = lazy(() => import("./CourseTracker").then(m => ({ default: m.CourseTracker })));
const LearningWorkspace = lazy(() => import("../learning/Workspace").then(m => ({ default: m.LearningWorkspace })));
const MaterialStudy = lazy(() => import("../learning/Workspace").then(m => ({ default: m.MaterialStudy })));
const WorkspaceSettings = lazy(() => import("../learning/Workspace").then(m => ({ default: m.WorkspaceSettings })));
const AgentWorkspace = lazy(() => import("../learning/agent/AgentWorkspace").then(m => ({ default: m.AgentWorkspace })));
const StageMap = lazy(() => import("./StageMap").then(m => ({ default: m.StageMap })));
const StageSession = lazy(() => import("./StageSession").then(m => ({ default: m.StageSession })));
const StudySession = lazy(() => import("./StudySession").then(m => ({ default: m.StudySession })));
import "./curve.css";

/**
 * The signed-in Curve product. Mounted at the application root for consumer
 * students so the forecast is the app, not a section of one.
 */
export function CurveApp() {
  const [params] = useSearchParams();
  const classic = params.get("classic") === "1" || params.get("legacy") === "1";

  return (
    <Routes>
      <Route
        path="/"
        element={classic ? <LearningWorkspace /> : <AgentWorkspace />}
      />
      <Route path="/workspace" element={<AgentWorkspace />} />
      <Route path="/classic" element={<LearningWorkspace />} />
      <Route path="/preview" element={<LearningWorkspace />} />
      <Route path="/library" element={<LearningWorkspace />} />
      <Route path="/courses" element={<LearningWorkspace />} />
      <Route path="/progress" element={<LearningWorkspace />} />
      <Route path="/settings" element={<WorkspaceSettings />} />
      <Route path="/learn/:sessionId" element={<MaterialStudy />} />
      <Route path="/tracker" element={<CourseTracker />} />
      <Route path="/add-course" element={<AddCourse />} />
      <Route path="/course/:enrollmentId" element={<CourseDetail />} />
      <Route path="/session/:enrollmentId" element={<StudySession />} />
      <Route path="/map" element={<StageMap />} />
      <Route path="/stage/:enrollmentId/:topicId" element={<StageSession />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default CurveApp;
