import React, { useEffect, useState } from 'react';
import { useParams, Navigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';

const TABS = ['Resources', 'Announcements', 'Assignments', 'Students'];

export const ClassPage: React.FC = () => {
  const { id } = useParams();
  const { user, role, loading } = useAuth() as any;
  const [classInfo, setClassInfo] = useState<any>(null);
  const [teacher, setTeacher] = useState<any>(null);
  const [students, setStudents] = useState<any[]>([]);
  const [resources, setResources] = useState<any[]>([]);
  const [announcements, setAnnouncements] = useState<any[]>([]);
  const [assignments, setAssignments] = useState<any[]>([]);
  const [tab, setTab] = useState('Resources');
  const [loadingData, setLoadingData] = useState(true);
  // Resource upload state
  const [resourceTitle, setResourceTitle] = useState('');
  const [resourceUrl, setResourceUrl] = useState('');
  const [resourceType, setResourceType] = useState('link');
  const [uploadingResource, setUploadingResource] = useState(false);
  const [resourceFile, setResourceFile] = useState<File | null>(null);
  // Announcement state
  const [announcementMsg, setAnnouncementMsg] = useState('');
  const [postingAnnouncement, setPostingAnnouncement] = useState(false);
  // Assignment state
  const [assignmentTitle, setAssignmentTitle] = useState('');
  const [assignmentDesc, setAssignmentDesc] = useState('');
  const [assignmentDue, setAssignmentDue] = useState('');
  const [postingAssignment, setPostingAssignment] = useState(false);

  useEffect(() => {
    const fetchData = async () => {
      setLoadingData(true);
      // Class info
      const { data: classData } = await supabase.from('classes').select('*').eq('id', id).single();
      setClassInfo(classData);
      // Teacher
      if (classData?.teacher_id) {
        const { data: teacherData } = await supabase.from('user_profiles').select('full_name, email').eq('id', classData.teacher_id).single();
        setTeacher(teacherData);
      }
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
      const { data: resourceData } = await supabase.from('class_resources').select('*').eq('class_id', id).order('created_at', { ascending: false });
      setResources(resourceData || []);
      // Announcements
      const { data: announcementData } = await supabase.from('class_announcements').select('*').eq('class_id', id).order('created_at', { ascending: false });
      setAnnouncements(announcementData || []);
      // Assignments
      const { data: assignmentData } = await supabase.from('class_assignments').select('*').eq('class_id', id).order('created_at', { ascending: false });
      setAssignments(assignmentData || []);
      setLoadingData(false);
    };
    fetchData();
  }, [id]);

  // Resource upload handler (teacher only)
  const handleResourceUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    setUploadingResource(true);
    let fileUrl = '';
    let type = resourceType;
    if (resourceType === 'file' && resourceFile) {
      // Upload file to Supabase Storage
      const ext = resourceFile.name.split('.').pop();
      const filePath = `${id}/${Date.now()}_${resourceFile.name}`;
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('class-resources')
        .upload(filePath, resourceFile);
      if (uploadError) {
        setUploadingResource(false);
        alert('File upload failed: ' + uploadError.message);
        return;
      }
      // Get public URL
      const { data: publicUrlData } = supabase.storage
        .from('class-resources')
        .getPublicUrl(filePath);
      fileUrl = publicUrlData.publicUrl;
      type = ext?.toLowerCase() === 'pdf' ? 'pdf' : ['jpg','jpeg','png','gif','webp','bmp'].includes(ext?.toLowerCase() || '') ? 'image' : 'file';
    }
    await supabase.from('class_resources').insert({
      class_id: id,
      title: resourceTitle,
      url: resourceType === 'link' ? resourceUrl : null,
      file_url: resourceType === 'file' ? fileUrl : null,
      type,
      uploaded_by: user.id
    });
    setResourceTitle('');
    setResourceUrl('');
    setResourceType('link');
    setResourceFile(null);
    setUploadingResource(false);
    // Refresh
    const { data: resourceData } = await supabase.from('class_resources').select('*').eq('class_id', id).order('created_at', { ascending: false });
    setResources(resourceData || []);
  };

  // Announcement post handler (teacher only)
  const handleAnnouncementPost = async (e: React.FormEvent) => {
    e.preventDefault();
    setPostingAnnouncement(true);
    await supabase.from('class_announcements').insert({
      class_id: id,
      message: announcementMsg,
      posted_by: user.id
    });
    setAnnouncementMsg('');
    setPostingAnnouncement(false);
    // Refresh
    const { data: announcementData } = await supabase.from('class_announcements').select('*').eq('class_id', id).order('created_at', { ascending: false });
    setAnnouncements(announcementData || []);
  };

  // Assignment post handler (teacher only)
  const handleAssignmentPost = async (e: React.FormEvent) => {
    e.preventDefault();
    setPostingAssignment(true);
    await supabase.from('class_assignments').insert({
      class_id: id,
      title: assignmentTitle,
      description: assignmentDesc,
      due_date: assignmentDue ? new Date(assignmentDue).toISOString() : null,
      posted_by: user.id
    });
    setAssignmentTitle('');
    setAssignmentDesc('');
    setAssignmentDue('');
    setPostingAssignment(false);
    // Refresh
    const { data: assignmentData } = await supabase.from('class_assignments').select('*').eq('class_id', id).order('created_at', { ascending: false });
    setAssignments(assignmentData || []);
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-900">
        <div className="w-16 h-16 border-4 border-blue-500/30 border-t-blue-500 rounded-full animate-spin"></div>
      </div>
    );
  }
  if (role === 'teacher') {
    return <Navigate to="/teacher" replace />;
  }

  return (
    <div className="min-h-screen bg-gray-900 p-6 text-gray-100">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-3xl font-bold text-blue-400 mb-2">{classInfo?.name || 'Class'}</h1>
        <div className="mb-4 text-gray-400 text-sm">Class Code: <span className="font-mono text-blue-400 select-all">{classInfo?.id}</span></div>
        <div className="mb-6 text-gray-300">Teacher: {teacher?.full_name || 'Unknown'} ({teacher?.email})</div>
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
        {/* Resources Tab */}
        {tab === 'Resources' && (
          <div>
            {role === 'teacher' && (
              <form onSubmit={handleResourceUpload} className="mb-6 bg-gray-800 p-4 rounded-xl border border-gray-700">
                <div className="mb-2 font-semibold text-gray-200">Upload/Share Resource</div>
                <input
                  className="w-full p-2 mb-2 rounded bg-gray-900 text-gray-100 border border-gray-700"
                  placeholder="Title"
                  value={resourceTitle}
                  onChange={e => setResourceTitle(e.target.value)}
                  required
                />
                <select
                  className="w-full p-2 mb-2 rounded bg-gray-900 text-gray-100 border border-gray-700"
                  value={resourceType}
                  onChange={e => setResourceType(e.target.value)}
                >
                  <option value="link">Link</option>
                  <option value="file">File Upload</option>
                </select>
                {resourceType === 'link' ? (
                  <input
                    className="w-full p-2 mb-2 rounded bg-gray-900 text-gray-100 border border-gray-700"
                    placeholder="Paste link here"
                    value={resourceUrl}
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
                >
                  {uploadingResource ? 'Uploading...' : 'Add Resource'}
                </button>
              </form>
            )}
            <div className="space-y-4">
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
          </div>
        )}
        {/* Announcements Tab */}
        {tab === 'Announcements' && (
          <div>
            {role === 'teacher' && (
              <form onSubmit={handleAnnouncementPost} className="mb-6 bg-gray-800 p-4 rounded-xl border border-gray-700">
                <div className="mb-2 font-semibold text-gray-200">Post Announcement</div>
                <textarea
                  className="w-full p-2 mb-2 rounded bg-gray-900 text-gray-100 border border-gray-700"
                  placeholder="Type your announcement..."
                  value={announcementMsg}
                  onChange={e => setAnnouncementMsg(e.target.value)}
                  required
                />
                <button
                  type="submit"
                  className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 transition"
                  disabled={postingAnnouncement}
                >
                  {postingAnnouncement ? 'Posting...' : 'Post Announcement'}
                </button>
              </form>
            )}
            <div className="space-y-4">
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
          </div>
        )}
        {/* Assignments Tab */}
        {tab === 'Assignments' && (
          <div>
            {role === 'teacher' && (
              <form onSubmit={handleAssignmentPost} className="mb-6 bg-gray-800 p-4 rounded-xl border border-gray-700">
                <div className="mb-2 font-semibold text-gray-200">Add Assignment</div>
                <input
                  className="w-full p-2 mb-2 rounded bg-gray-900 text-gray-100 border border-gray-700"
                  placeholder="Title"
                  value={assignmentTitle}
                  onChange={e => setAssignmentTitle(e.target.value)}
                  required
                />
                <textarea
                  className="w-full p-2 mb-2 rounded bg-gray-900 text-gray-100 border border-gray-700"
                  placeholder="Description"
                  value={assignmentDesc}
                  onChange={e => setAssignmentDesc(e.target.value)}
                />
                <input
                  type="date"
                  className="w-full p-2 mb-2 rounded bg-gray-900 text-gray-100 border border-gray-700"
                  value={assignmentDue}
                  onChange={e => setAssignmentDue(e.target.value)}
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
            <div className="space-y-4">
              {assignments.length === 0 ? (
                <div className="text-gray-400">No assignments yet.</div>
              ) : (
                assignments.map(a => (
                  <div key={a.id} className="bg-gray-800 p-4 rounded-xl border border-gray-700">
                    <div className="font-semibold text-blue-300">{a.title}</div>
                    <div className="text-gray-200 mb-2">{a.description}</div>
                    {a.due_date && <div className="text-xs text-yellow-400">Due: {new Date(a.due_date).toLocaleDateString()}</div>}
                    <div className="text-xs text-gray-500 mt-2">{new Date(a.created_at).toLocaleString()}</div>
                  </div>
                ))
              )}
            </div>
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
      </div>
    </div>
  );
}; 