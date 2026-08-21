import { Navigate, Route, Routes } from 'react-router-dom';

import { AddCourse } from './AddCourse';
import { CourseDetail } from './CourseDetail';
import { CourseTracker } from './CourseTracker';
import { CurveDashboard } from './CurveDashboard';
import { StageMap } from './StageMap';
import { StageSession } from './StageSession';
import { StudySession } from './StudySession';
import './curve.css';

/**
 * The signed-in Curve product. Mounted at the application root for consumer
 * students so the forecast is the app, not a section of one.
 */
export function CurveApp() {
  return (
    <Routes>
      <Route path="/" element={<CurveDashboard />} />
      <Route path="/preview" element={<CurveDashboard />} />
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
