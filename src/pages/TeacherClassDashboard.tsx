import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { Bell } from 'lucide-react';
import { marked } from 'marked';

const TABS = ['Overview', 'Students', 'Resources', 'Announcements', 'Assignments', 'Analytics', 'AI Insights', 'Notifications'];

const TeacherClassDashboard: React.FC = () => {
  const { id } = useParams();
  const { user, role, loading } = useAuth() as any;
  const [classInfo, setClassInfo] = useState<any>(null);
  const [students, setStudents] = useState<any[]>([]);
  const [resources, setResources] = useState<any[]>([]);
  const [announcements, setAnnouncements] = useState<any[]>([]);
  const [assignments, setAssignments] = useState<any[]>([]);
  const [tab, setTab] = useState('Overview');
  const [loadingData, setLoadingData] = useState(true);
  // For AI Insights
  const [aiSummary, setAiSummary] = useState<string>('');
  const [aiLoading, setAiLoading] = useState(false);

  // Resource upload state
  const [resourceTitle, setResourceTitle] = useState('');
  const [resourceUrl, setResourceUrl] = useState('');
  const [resourceType, setResourceType] = useState('link');
  const [uploadingResource, setUploadingResource] = useState(false);
  const [resourceFile, setResourceFile] = useState<File | null>(null);

  // Add state for forms above component
  const [announcementContent, setAnnouncementContent] = useState('');
  const [announcementError, setAnnouncementError] = useState('');
  const [postingAnnouncement, setPostingAnnouncement] = useState(false);

  const [assignmentTitle, setAssignmentTitle] = useState('');
  const [assignmentDesc, setAssignmentDesc] = useState('');
  const [assignmentDueDate, setAssignmentDueDate] = useState('');
  const [assignmentFile, setAssignmentFile] = useState<File | null>(null);
  const [assignmentError, setAssignmentError] = useState('');
  const [postingAssignment, setPostingAssignment] = useState(false);

  const [notifications, setNotifications] = useState<any[]>([]);
  const [loadingNotifications, setLoadingNotifications] = useState(true);
  const [showNotifModal, setShowNotifModal] = useState(false);
  const [notifModalContent, setNotifModalContent] = useState<string>('');
  const [notifModalTitle, setNotifModalTitle] = useState<string>('');

  const handleNotificationClick = async (notif: any) => {
    if (!notif.attempt_id) return;
    // Fetch weaknesses for this attempt
    const { data } = await supabase
      .from('cbse_exam_attempts')
      .select('student_weaknesses')
      .eq('id', notif.attempt_id)
      .single();
    setNotifModalTitle(notif.title);
    setNotifModalContent(data?.student_weaknesses || 'No weaknesses found.');
    setShowNotifModal(true);
  };

  useEffect(() => {
    if (!user || !id) {
      console.log('On page load: user or id not ready', { user, id });
      return;
    }
    const fetchData = async () => {
      setLoadingData(true);
      // Class info
      const { data: classData } = await supabase.from('classes').select('*').eq('id', id).single();
      setClassInfo(classData);
      // Students
      const { data: memberData } = await supabase.from('class_members').select('user_id').eq('class_id', id);
      if (memberData && memberData.length > 0) {
        const userIds = memberData.map((m: any) => m.user_id);
        const { data: studentProfiles } = await supabase.from('user_profiles').select('full_name, email').in('id', userIds);
        setStudents(studentProfiles || []);
      } else {
        setStudents([]);
      }
      // Resources
      const { data: resourceData } = await supabase.from('class_resources').select('*').eq('class_id', id);
      setResources(resourceData || []);
      // Announcements
      const { data: announcementData } = await supabase.from('class_announcements').select('*').eq('class_id', id);
      setAnnouncements(announcementData || []);
      // Assignments
      const { data: assignmentData, error } = await supabase.from('assignments').select('*').eq('class_id', id);
      console.log('On page load: fetched assignments:', assignmentData, 'Error:', error, { user, id });
      setAssignments(assignmentData || []);
      setLoadingData(false);
    };
    fetchData();
  }, [user, id]);

  useEffect(() => {
    const fetchNotifications = async () => {
      if (!user || !id) return;
      setLoadingNotifications(true);
      console.log('Fetching notifications for teacher:', user.id, 'class:', id);
      
      // Fetch notifications for this teacher and this class (if class_id is stored in notification)
      const { data, error } = await supabase
        .from('notifications')
        .select('*')
        .eq('user_id', user.id)
        .eq('class_id', id)
        .order('created_at', { ascending: false })
        .limit(20);
      
      console.log('Notifications fetch result:', { data, error });
      
      setNotifications(data || []);
      setLoadingNotifications(false);
    };
    if (role === 'teacher') fetchNotifications();
  }, [user, role, id]);

  // AI Insights: Call Supabase Edge Function for Gemini
  const fetchAiSummary = async () => {
    setAiLoading(true);
    setAiSummary('');
    try {
      const { data, error } = await supabase.functions.invoke('teacher-ai-insights', {
        body: {
          classId: id,
          students,
          resources,
          assignments,
          prompt: 'Summarize class performance and suggest interventions for the teacher.'
        }
      });
      if (error) throw error;
      setAiSummary(data?.summary || 'No summary returned.');
    } catch (err: any) {
      setAiSummary('Failed to generate AI insights: ' + (err.message || err));
    } finally {
      setAiLoading(false);
    }
  };

  useEffect(() => {
    if (tab === 'AI Insights') fetchAiSummary();
  }, [tab, students, resources]);

  // Resource upload handler (teacher only)
  const handleResourceUpload = async (e: React.FormEvent) => {
    console.log('handleResourceUpload called');
    e.preventDefault();
    console.log('After preventDefault');
    if (!user) {
      console.log('No user!');
      return;
    }
    if (!id) {
      console.log('No class_id!');
      setUploadingResource(false);
      alert('No class selected. Please reload the page.');
      return;
    }
    setUploadingResource(true);
    let fileUrl = '';
    let type = resourceType;
    console.log('Before file upload, resourceType:', resourceType);
    if (resourceType === 'file' && resourceFile) {
      console.log('Uploading file:', resourceFile);
      const ext = resourceFile.name.split('.').pop();
      const filePath = `${id}/${Date.now()}_${resourceFile.name}`;
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('class-resources')
        .upload(filePath, resourceFile);
      if (uploadError) {
        setUploadingResource(false);
        alert('File upload failed: ' + uploadError.message);
        console.log('File upload error:', uploadError);
        return;
      }
      // Get public URL
      const { data: publicUrlData } = supabase.storage
        .from('class-resources')
        .getPublicUrl(filePath);
      fileUrl = publicUrlData.publicUrl;
      type = ext?.toLowerCase() === 'pdf' ? 'pdf' : ['jpg','jpeg','png','gif','webp','bmp'].includes(ext?.toLowerCase() || '') ? 'image' : 'file';
      console.log('File uploaded, fileUrl:', fileUrl, 'type:', type);
    }
    const insertObj = {
      class_id: id,
      title: resourceTitle,
      url: resourceType === 'link' ? resourceUrl : null,
      file_url: resourceType === 'file' ? fileUrl : null,
      type,
      uploaded_by: user.id
    };
    console.log('Uploading resource as user:', user?.id, insertObj);
    await supabase.from('class_resources').insert(insertObj);
    setResourceTitle('');
    setResourceUrl('');
    setResourceType('link');
    setResourceFile(null);
    setUploadingResource(false);
    // Refresh
    const { data: resourceData } = await supabase.from('class_resources').select('*').eq('class_id', id);
    setResources(resourceData || []);
  };

  // Add this useEffect to log when the resource upload form is rendered
  React.useEffect(() => {
    if (role === 'teacher' && tab === 'Resources') {
      console.log('Resource upload form rendered');
    }
  }, [role, tab]);

  const handlePostAnnouncement = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!announcementContent.trim()) {
      setAnnouncementError('Announcement cannot be empty.');
      return;
    }
    setPostingAnnouncement(true);
    setAnnouncementError('');
    const { error } = await supabase.from('class_announcements').insert({
      class_id: id,
      message: announcementContent,
    });
    if (error) {
      setAnnouncementError('Failed to post announcement.');
    } else {
      setAnnouncementContent('');
      // Refresh announcements
      const { data: announcementData } = await supabase.from('class_announcements').select('*').eq('class_id', id);
      setAnnouncements(announcementData || []);
    }
    setPostingAnnouncement(false);
  };

  const handlePostAssignment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!assignmentTitle.trim()) {
      setAssignmentError('Title is required.');
      return;
    }
    setPostingAssignment(true);
    setAssignmentError('');
    let fileUrl: string | null = null;
    if (assignmentFile) {
      const filePath = `${user.id}/${id}/${Date.now()}_${assignmentFile.name}`;
      console.log("Uploading to bucket: assignments, path:", filePath);
      const { data, error: uploadError } = await supabase.storage.from('assignments').upload(filePath, assignmentFile);
      if (uploadError) {
        setAssignmentError('Error uploading file: ' + uploadError.message);
        setPostingAssignment(false);
        // Log the full error object for diagnosis
        console.error("Supabase upload error:", uploadError);
        alert("Upload error: " + JSON.stringify(uploadError, null, 2));
        return;
      }
      const { data: publicURLData } = supabase.storage.from('assignments').getPublicUrl(filePath);
      fileUrl = publicURLData.publicUrl;
    }
    const { error } = await supabase.from('assignments').insert({
      class_id: id,
      title: assignmentTitle,
      description: assignmentDesc,
      due_date: assignmentDueDate || null,
      file_url: fileUrl,
    });
    if (error) {
      setAssignmentError('Failed to create assignment: ' + error.message);
      console.error('Insert error:', error);
      alert('Insert error: ' + JSON.stringify(error, null, 2));
    } else {
      setAssignmentTitle('');
      setAssignmentDesc('');
      setAssignmentDueDate('');
      setAssignmentFile(null);
      // Refresh assignments
      const { data: assignmentData, error } = await supabase.from('assignments').select('*').eq('class_id', id);
      console.log('Fetched assignments:', assignmentData, 'Error:', error);
      setAssignments(assignmentData || []);
    }
    setPostingAssignment(false);
  };

  if (loading || loadingData) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-900">
        <div className="w-16 h-16 border-4 border-blue-500/30 border-t-blue-500 rounded-full animate-spin"></div>
      </div>
    );
  }

  if (role !== 'teacher') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-900">
        <div className="bg-gray-800 p-8 rounded-xl shadow text-center border border-gray-700">
          <h2 className="text-2xl font-bold text-red-400 mb-2">Access Denied</h2>
          <p className="text-gray-300">You must be a teacher to access this dashboard.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-900 p-6 text-gray-100">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-3xl font-bold text-blue-400 mb-2">{classInfo?.name || 'Class'}</h1>
        <div className="mb-4 text-gray-400 text-sm">Class Code: <span className="font-mono text-blue-400 select-all">{classInfo?.id}</span></div>
        <div className="mb-6 flex gap-4">
          {TABS.map(t => (
            <button
              key={t}
              className={`px-4 py-2 rounded ${tab === t ? 'bg-blue-700 text-white' : 'bg-gray-800 text-gray-300'} font-semibold`}
              onClick={() => setTab(t)}
            >
              {t}
            </button>
          ))}
        </div>
        {/* Overview Tab */}
        {tab === 'Overview' && (
          <div className="bg-gray-800 p-6 rounded-xl border border-gray-700 mb-6">
            <div className="mb-2 text-lg font-semibold text-blue-300">Class Overview</div>
            <div className="text-gray-200">Students: {students.length}</div>
            <div className="text-gray-200">Resources: {resources.length}</div>
            <div className="text-gray-200">Assignments: {assignments.length}</div>
            <div className="text-gray-200">Announcements: {announcements.length}</div>
          </div>
        )}
        {/* Students Tab */}
        {tab === 'Students' && (
          <div className="space-y-4">
            {students.length === 0 ? (
              <div className="text-gray-400">No students in this class yet.</div>
            ) : (
              students.map((s, i) => (
                <div key={i} className="bg-gray-800 p-4 rounded-xl border border-gray-700 flex flex-col md:flex-row md:items-center md:justify-between">
                  <div>
                    <div className="font-semibold text-blue-300">{s.full_name}</div>
                    <div className="text-sm text-gray-400">{s.email}</div>
                  </div>
                </div>
              ))
            )}
          </div>
        )}
        {/* Resources Tab */}
        {tab === 'Resources' && (
          <div className="space-y-4">
            {/* Teacher upload form */}
            {role === 'teacher' && (
              <form onSubmit={handleResourceUpload} className="mb-6 bg-gray-800 p-4 rounded-xl border border-gray-700">
                <div className="mb-2 font-semibold text-gray-200">Upload/Share Resource</div>
                <input
                  className="w-full p-2 mb-2 rounded bg-gray-900 text-gray-100 border border-gray-700"
                  placeholder="Title"
                  value={resourceTitle || ''}
                  onChange={e => setResourceTitle(e.target.value)}
                  required
                />
                <select
                  className="w-full p-2 mb-2 rounded bg-gray-900 text-gray-100 border border-gray-700"
                  value={resourceType || 'link'}
                  onChange={e => setResourceType(e.target.value)}
                >
                  <option value="link">Link</option>
                  <option value="file">File Upload</option>
                </select>
                {resourceType === 'link' ? (
                  <input
                    className="w-full p-2 mb-2 rounded bg-gray-900 text-gray-100 border border-gray-700"
                    placeholder="Paste link here"
                    value={resourceUrl || ''}
                    onChange={e => setResourceUrl(e.target.value)}
                    required
                  />
                ) : (
                  <input
                    type="file"
                    className="w-full p-2 mb-2 rounded bg-gray-900 text-gray-100 border border-gray-700"
                    accept="*"
                    onChange={e => setResourceFile(e.target.files?.[0] || null)}
                    required
                  />
                )}
                <button
                  type="submit"
                  className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 transition"
                  disabled={uploadingResource}
                  onClick={() => { console.log('Resource upload button clicked'); }}
                >
                  {uploadingResource ? 'Uploading...' : 'Add Resource'}
                </button>
              </form>
            )}
            {resources.length === 0 ? (
              <div className="text-gray-400">No resources yet.</div>
            ) : (
              resources.map(r => (
                <div key={r.id} className="bg-gray-800 p-4 rounded-xl border border-gray-700 flex flex-col md:flex-row md:items-center md:justify-between">
                  <div>
                    <div className="font-semibold text-blue-300">{r.title}</div>
                    <div className="text-sm text-gray-400">
                      {r.type === 'link' && <a href={r.url} target="_blank" rel="noopener noreferrer" className="underline text-blue-400">{r.url}</a>}
                      {r.type === 'pdf' && <a href={r.file_url} target="_blank" rel="noopener noreferrer" className="underline text-blue-400">PDF File</a>}
                      {r.type === 'image' && <a href={r.file_url} target="_blank" rel="noopener noreferrer"><img src={r.file_url} alt={r.title} className="max-h-32 rounded mt-2" /></a>}
                      {r.type === 'file' && <a href={r.file_url} target="_blank" rel="noopener noreferrer" className="underline text-blue-400">Download File</a>}
                    </div>
                  </div>
                  <div className="text-xs text-gray-500 mt-2 md:mt-0">{r.file_url ? r.file_url.split('/').pop() : ''}</div>
                </div>
              ))
            )}
          </div>
        )}
        {/* Announcements Tab */}
        {tab === 'Announcements' && (
          <div className="space-y-4">
            {role === 'teacher' && (
              <form onSubmit={handlePostAnnouncement} className="mb-6 p-4 bg-gray-900 rounded-lg border border-gray-700">
                <h3 className="font-bold mb-2 text-blue-300">Post New Announcement</h3>
                {announcementError && <p className="text-red-500 mb-2">{announcementError}</p>}
                <textarea
                  placeholder="Type your announcement..."
                  value={announcementContent}
                  onChange={e => setAnnouncementContent(e.target.value)}
                  required
                  className="w-full p-2 mb-2 border rounded bg-gray-800 text-gray-100 border-gray-700"
                />
                <button
                  type="submit"
                  className="bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700 transition"
                  disabled={postingAnnouncement}
                >
                  {postingAnnouncement ? 'Posting...' : 'Post Announcement'}
                </button>
              </form>
            )}
            {announcements.length === 0 ? (
              <div className="text-gray-400">No announcements yet.</div>
            ) : (
              announcements.map(a => (
                <div key={a.id} className="bg-gray-800 p-4 rounded-xl border border-gray-700">
                  <div className="text-gray-200">{a.message}</div>
                  <div className="text-xs text-gray-500 mt-2">{new Date(a.created_at).toLocaleString()}</div>
                </div>
              ))
            )}
          </div>
        )}
        {/* Assignments Tab */}
        {tab === 'Assignments' && (
          <div className="space-y-4">
            {role === 'teacher' && (
              <form onSubmit={handlePostAssignment} className="mb-6 p-4 bg-gray-900 rounded-lg border border-gray-700">
                <h3 className="font-bold mb-2 text-blue-300">Create New Assignment</h3>
                {assignmentError && <p className="text-red-500 mb-2">{assignmentError}</p>}
                <input
                  type="text"
                  placeholder="Title"
                  value={assignmentTitle}
                  onChange={e => setAssignmentTitle(e.target.value)}
                  required
                  className="w-full p-2 mb-2 border rounded bg-gray-800 text-gray-100 border-gray-700"
                />
                <textarea
                  placeholder="Description"
                  value={assignmentDesc}
                  onChange={e => setAssignmentDesc(e.target.value)}
                  className="w-full p-2 mb-2 border rounded bg-gray-800 text-gray-100 border-gray-700"
                />
                <input
                  type="date"
                  value={assignmentDueDate}
                  onChange={e => setAssignmentDueDate(e.target.value)}
                  className="w-full p-2 mb-2 border rounded bg-gray-800 text-gray-100 border-gray-700"
                />
                <input
                  type="file"
                  onChange={e => setAssignmentFile(e.target.files ? e.target.files[0] : null)}
                  className="w-full p-2 mb-2 border rounded bg-gray-800 text-gray-100 border-gray-700"
                />
                <button
                  type="submit"
                  className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 transition"
                  disabled={postingAssignment}
                >
                  {postingAssignment ? 'Posting...' : 'Add Assignment'}
                </button>
              </form>
            )}
            {assignments.length === 0 ? (
              <div className="text-gray-400">No assignments yet.</div>
            ) : (
              assignments.map(a => (
                <div key={a.id} className="bg-gray-800 p-4 rounded-xl border border-gray-700">
                  <div className="font-semibold text-blue-300">{a.title}</div>
                  <div className="text-gray-200 mb-2">{a.description}</div>
                  {a.due_date && <div className="text-xs text-yellow-400">Due: {new Date(a.due_date).toLocaleDateString()}</div>}
                  {/* Show image preview if file_url is an image, else show download link */}
                  {a.file_url && (
                    a.file_url.match(/\.(jpg|jpeg|png|gif|webp|bmp)$/i) ? (
                      <img
                        src={a.file_url}
                        alt={a.title}
                        className="max-h-48 rounded mt-2"
                        style={{ maxWidth: '100%' }}
                      />
                    ) : (
                      <a
                        href={a.file_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-blue-500 hover:underline"
                      >
                        Download File
                      </a>
                    )
                  )}
                  <div className="text-xs text-gray-500 mt-2">{new Date(a.created_at).toLocaleString()}</div>
                </div>
              ))
            )}
          </div>
        )}
        {/* Analytics Tab */}
        {tab === 'Analytics' && (
          <div className="bg-gray-800 p-6 rounded-xl border border-gray-700 mb-6">
            <div className="mb-2 text-lg font-semibold text-blue-300">Class Analytics</div>
            <div className="text-gray-200">Students: {students.length}</div>
            <div className="text-gray-200">Resources: {resources.length}</div>
            <div className="text-gray-200">Assignments: {assignments.length}</div>
            <div className="text-gray-200">Announcements: {announcements.length}</div>
            {/* Add more analytics as needed */}
          </div>
        )}
        {/* AI Insights Tab */}
        {tab === 'AI Insights' && (
          <div className="bg-gray-800 p-6 rounded-xl border border-gray-700 mb-6">
            <div className="mb-2 text-lg font-semibold text-blue-300">AI Insights</div>
            {aiLoading ? (
              <div className="text-gray-400">Generating insights...</div>
            ) : (
              <div className="text-gray-200 whitespace-pre-line">{aiSummary}</div>
            )}
          </div>
        )}
        {/* Notifications Tab */}
        {tab === 'Notifications' && (
          <div className="mb-8">
            <h2 className="text-xl font-bold text-blue-400 flex items-center gap-2 mb-2"><Bell className="w-6 h-6" /> Notifications</h2>
            {loadingNotifications ? (
              <div className="text-blue-400">Loading notifications...</div>
            ) : notifications.length === 0 ? (
              <div className="text-gray-400">No notifications yet.</div>
            ) : (
              <div className="space-y-2">
                {notifications.map((notif, i) => (
                  <div
                    key={notif.id || i}
                    className={`p-4 rounded-lg border ${notif.is_read ? 'border-gray-700 bg-gray-800 opacity-60' : 'border-blue-700 bg-blue-950'} transition-all cursor-pointer`}
                    onClick={() => handleNotificationClick(notif)}
                  >
                    <div className="font-semibold text-white mb-1">{notif.title}</div>
                    <div className="text-gray-300 mb-1">{notif.message}</div>
                    <div className="text-xs text-gray-400">{notif.created_at ? new Date(notif.created_at).toLocaleString() : ''}</div>
                  </div>
                ))}
              </div>
            )}
           {/* Modal for weaknesses */}
           {showNotifModal && (
             <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-70">
               <div className="bg-gray-900 rounded-xl border border-blue-800 p-8 max-w-2xl w-full relative">
                 <button className="absolute top-4 right-4 text-gray-400 hover:text-white text-2xl" onClick={() => setShowNotifModal(false)}>&times;</button>
                 <h3 className="text-xl font-bold text-blue-300 mb-2">{notifModalTitle}</h3>
                 <div className="mb-4 text-white prose prose-invert max-w-none" dangerouslySetInnerHTML={{ __html: marked(notifModalContent) as string }} />
               </div>
             </div>
           )}
          </div>
        )}
      </div>
    </div>
  );
};

export default TeacherClassDashboard; 