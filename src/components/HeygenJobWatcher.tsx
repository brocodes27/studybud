import { useCallback, useEffect, useRef } from 'react';
import { HeygenService } from '../lib/heygenService';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';

interface SavedVideoJob {
  id: string;
  topic: string | null;
  subject: string | null;
  heygen_video_id: string | null;
  heygen_video_url?: string | null;
  heygen_status: string | null;
}

const ACTIVE_STATUSES = ['pending', 'processing', 'polling', 'generating'];

export function HeygenJobWatcher() {
  const { user } = useAuth() as any;
  const activePolls = useRef(new Set<string>());
  const controllers = useRef(new Map<string, AbortController>());
  const heygen = HeygenService.getInstance();

  const notifyBrowser = useCallback((job: SavedVideoJob) => {
    if (typeof window === 'undefined' || !('Notification' in window)) return;

    const title = 'Your blackboard video is ready';
    const body = `${job.subject || 'Lesson'} • ${job.topic || 'Topic'} is ready to watch.`;

    const push = () => {
      try {
        // Try using native notifications when permitted
        // eslint-disable-next-line no-new
        new Notification(title, {
          body,
          icon: '/favicon.ico',
          tag: `heygen-${job.id}`
        });
      } catch (err) {
        console.warn('Notification error', err);
      }
    };

    if (Notification.permission === 'granted') {
      push();
      return;
    }

    if (Notification.permission === 'default') {
      Notification.requestPermission().then((permission) => {
        if (permission === 'granted') push();
      }).catch(() => {});
    }
  }, []);

  const updateSavedVideo = useCallback(async (videoId: string, patch: Record<string, any>) => {
    if (!user) return;
    await supabase
      .from('saved_videos')
      .update({
        ...patch,
        heygen_last_checked_at: new Date().toISOString()
      })
      .eq('heygen_video_id', videoId)
      .eq('user_id', user.id);
  }, [user]);

  const pollVideo = useCallback(async (job: SavedVideoJob) => {
    if (!user || !job.heygen_video_id) return;
    if (activePolls.current.has(job.heygen_video_id)) return;

    const videoId = job.heygen_video_id;
    const controller = new AbortController();
    activePolls.current.add(videoId);
    controllers.current.set(videoId, controller);

    try {
      const url = await heygen.waitForVideoUrl(videoId, { maxAttempts: 40, delayMs: 4000, signal: controller.signal });
      if (controller.signal.aborted) return;

      if (url) {
        await updateSavedVideo(videoId, { heygen_status: 'ready', heygen_video_url: url, heygen_error: null });
        notifyBrowser(job);
      } else {
        await updateSavedVideo(videoId, { heygen_status: 'error', heygen_error: 'HeyGen returned no download URL' });
      }
    } catch (e: any) {
      if (controller.signal.aborted) return;
      await updateSavedVideo(videoId, { heygen_status: 'error', heygen_error: e?.message || 'HeyGen video generation failed' });
    } finally {
      activePolls.current.delete(videoId);
      controllers.current.delete(videoId);
    }
  }, [user, notifyBrowser, updateSavedVideo, heygen]);

  const handleJob = useCallback((job?: SavedVideoJob | null) => {
    if (!job) return;
    if (job.heygen_status === 'ready') {
      notifyBrowser(job);
      return;
    }
    if (ACTIVE_STATUSES.includes(job.heygen_status || '') && job.heygen_video_id) {
      pollVideo(job);
    }
  }, [pollVideo, notifyBrowser]);

  useEffect(() => {
    if (!user) return undefined;

    let cancelled = false;

    const fetchExisting = async () => {
      const { data } = await supabase
        .from('saved_videos')
        .select('id, topic, subject, heygen_video_id, heygen_status')
        .eq('user_id', user.id)
        .in('heygen_status', ACTIVE_STATUSES);

      if (cancelled || !data) return;
      data.forEach(handleJob);
    };

    fetchExisting();

    const channel = supabase
      .channel(`heygen-jobs-${user.id}`)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'saved_videos',
        filter: `user_id=eq.${user.id}`
      }, (payload) => {
        const job = payload.new as SavedVideoJob;
        handleJob(job);
      })
      .subscribe();

    return () => {
      cancelled = true;
      channel.unsubscribe();
      controllers.current.forEach((controller) => controller.abort());
      controllers.current.clear();
      activePolls.current.clear();
    };
  }, [user, handleJob]);

  return null;
}

export default HeygenJobWatcher;
