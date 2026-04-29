-- Unified Student Intelligence Layer — Functions

-- ============================================================
-- compute_prereq_readiness
-- ============================================================
CREATE OR REPLACE FUNCTION public.compute_prereq_readiness(
    p_user_id uuid, p_kc_id uuid, p_threshold numeric DEFAULT 0.7
)
RETURNS numeric AS $$
DECLARE
    total_prereqs int;
    ready_prereqs int;
BEGIN
    SELECT COUNT(*), COUNT(CASE WHEN stm.mastery_probability >= p_threshold THEN 1 END)
    INTO total_prereqs, ready_prereqs
    FROM public.knowledge_graph_edges kge
    LEFT JOIN public.student_topic_mastery stm 
        ON stm.kc_id = kge.parent_kc_id AND stm.user_id = p_user_id
    WHERE kge.child_kc_id = p_kc_id AND kge.edge_type = 'prerequisite';
    
    RETURN CASE WHEN total_prereqs = 0 THEN 1.0 ELSE ready_prereqs::numeric / total_prereqs END;
END;
$$ LANGUAGE plpgsql STABLE;

-- ============================================================
-- sync_topic_mastery_from_bkt
-- ============================================================
CREATE OR REPLACE FUNCTION public.sync_topic_mastery_from_bkt()
RETURNS TRIGGER AS $$
DECLARE
    new_consecutive_correct int := 0;
    new_consecutive_incorrect int := 0;
    new_correct_count int := 0;
BEGIN
    IF NEW.last_correct THEN
        new_consecutive_correct := 1;
        new_consecutive_incorrect := 0;
    ELSE
        new_consecutive_correct := 0;
        new_consecutive_incorrect := 1;
    END IF;
    new_correct_count := CASE WHEN NEW.last_correct THEN COALESCE(NEW.interaction_count, 0) ELSE 0 END;

    INSERT INTO public.student_topic_mastery (
        user_id, kc_id, mastery_probability, confidence, cognitive_tier,
        questions_attempted, questions_correct, consecutive_correct, consecutive_incorrect,
        last_interaction_result, last_practiced_at, updated_by
    )
    VALUES (
        NEW.user_id, NEW.kc_id, COALESCE(NEW.p_mastery, 0.1), COALESCE(NEW.confidence_interval, 0.1),
        COALESCE(NEW.cognitive_tier, 'novice'), COALESCE(NEW.interaction_count, 0),
        new_correct_count, new_consecutive_correct, new_consecutive_incorrect,
        NEW.last_correct, NEW.last_interaction_at, 'bkt'
    )
    ON CONFLICT (user_id, kc_id) DO UPDATE SET
        mastery_probability = EXCLUDED.mastery_probability,
        confidence = EXCLUDED.confidence,
        cognitive_tier = EXCLUDED.cognitive_tier,
        questions_attempted = EXCLUDED.questions_attempted,
        questions_correct = EXCLUDED.questions_correct,
        consecutive_correct = EXCLUDED.consecutive_correct,
        consecutive_incorrect = EXCLUDED.consecutive_incorrect,
        last_interaction_result = EXCLUDED.last_interaction_result,
        last_practiced_at = EXCLUDED.last_practiced_at,
        updated_by = 'bkt',
        updated_at = now();
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS sync_bkt_to_topic_mastery ON public.student_cognitive_profiles;
CREATE TRIGGER sync_bkt_to_topic_mastery
    AFTER INSERT OR UPDATE ON public.student_cognitive_profiles
    FOR EACH ROW
    WHEN (NEW.user_id IS NOT NULL AND NEW.kc_id IS NOT NULL)
    EXECUTE FUNCTION public.sync_topic_mastery_from_bkt();

-- ============================================================
-- Derived-metric refresh helpers
-- ============================================================
CREATE OR REPLACE FUNCTION public.update_predicted_retention()
RETURNS void AS $$
BEGIN
    UPDATE public.student_topic_mastery
    SET predicted_retention = GREATEST(0, LEAST(1, 
        mastery_probability * POWER(2, 
            -EXTRACT(EPOCH FROM (now() - COALESCE(last_practiced_at, first_seen_at, now()))) / 86400.0 / NULLIF(half_life_days, 0)
        )
    ));
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.update_prereq_readiness()
RETURNS void AS $$
BEGIN
    UPDATE public.student_topic_mastery stm
    SET prereq_readiness_score = COALESCE((
        SELECT CASE WHEN COUNT(*) = 0 THEN 1.0
            ELSE COUNT(CASE WHEN stm2.mastery_probability >= stm.prereq_mastery_required THEN 1 END)::numeric / COUNT(*) END
        FROM public.knowledge_graph_edges kge
        LEFT JOIN public.student_topic_mastery stm2 ON stm2.kc_id = kge.parent_kc_id AND stm2.user_id = stm.user_id
        WHERE kge.child_kc_id = stm.kc_id AND kge.edge_type = 'prerequisite'
    ), 1.0);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.update_velocity_metrics()
RETURNS void AS $$
BEGIN
    UPDATE public.student_learning_velocity
    SET 
        mastery_delta = GREATEST(0, current_mastery - initial_mastery),
        velocity_per_day = CASE WHEN days_active > 0 THEN (current_mastery - initial_mastery) / days_active ELSE 0 END,
        velocity_per_hour = CASE WHEN total_practice_minutes > 0 THEN (current_mastery - initial_mastery) / (total_practice_minutes / 60.0) ELSE 0 END,
        velocity_per_attempt = CASE WHEN total_attempts > 0 THEN (current_mastery - initial_mastery) / total_attempts ELSE 0 END,
        velocity_tier = CASE 
            WHEN days_active = 0 THEN 'unknown'
            WHEN (current_mastery - initial_mastery) / NULLIF(days_active, 0) >= 0.15 THEN 'accelerated'
            WHEN (current_mastery - initial_mastery) / NULLIF(days_active, 0) >= 0.08 THEN 'steady'
            WHEN (current_mastery - initial_mastery) / NULLIF(days_active, 0) >= 0.03 THEN 'slow'
            WHEN (current_mastery - initial_mastery) / NULLIF(days_active, 0) > 0 THEN 'struggling'
            ELSE 'stalled'
        END,
        days_since_active = EXTRACT(DAY FROM (now() - COALESCE(last_active_at, first_interaction_at, now())))::integer,
        updated_at = now();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.update_avoidance_rates()
RETURNS void AS $$
BEGIN
    UPDATE public.student_avoidance_patterns
    SET 
        avoidance_rate = CASE WHEN scheduled_count > 0 
            THEN (skipped_count + postponed_count * 0.5)::numeric / scheduled_count ELSE 0 END,
        pattern_label = CASE 
            WHEN scheduled_count >= 5 AND (skipped_count + postponed_count * 0.5)::numeric / NULLIF(scheduled_count, 0) >= 0.8 THEN 'chronic_avoider'
            WHEN scheduled_count >= 3 AND (skipped_count + postponed_count * 0.5)::numeric / NULLIF(scheduled_count, 0) >= 0.5 THEN 'consistent_avoider'
            WHEN scheduled_count >= 2 AND (skipped_count + postponed_count * 0.5)::numeric / NULLIF(scheduled_count, 0) >= 0.3 THEN 'hesitant'
            WHEN scheduled_count >= 1 AND (skipped_count + postponed_count * 0.5)::numeric / NULLIF(scheduled_count, 0) >= 0.15 THEN 'occasional_skipper'
            ELSE 'engaged'
        END,
        updated_at = now();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.update_misconception_severity()
RETURNS void AS $$
BEGIN
    UPDATE public.student_misconceptions
    SET 
        severity = LEAST(1.0, (occurrence_count::numeric / 10.0) * 
            CASE 
                WHEN resolved THEN 0.1
                WHEN now() - last_observed_at < interval '3 days' THEN 1.0
                WHEN now() - last_observed_at < interval '7 days' THEN 0.7
                WHEN now() - last_observed_at < interval '30 days' THEN 0.4
                ELSE 0.2
            END
        ),
        updated_at = now();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.refresh_derived_metrics()
RETURNS void AS $$
BEGIN
    PERFORM public.update_predicted_retention();
    PERFORM public.update_prereq_readiness();
    PERFORM public.update_velocity_metrics();
    PERFORM public.update_avoidance_rates();
    PERFORM public.update_misconception_severity();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================
-- refresh_student_twin_snapshot
-- ============================================================
CREATE OR REPLACE FUNCTION public.refresh_student_twin_snapshot(p_user_id uuid)
RETURNS uuid AS $$
DECLARE
    v_snapshot_id uuid;
    v_next_version integer;
    v_behavioral jsonb;
    v_mastery jsonb;
    v_cognitive jsonb;
    v_motivation jsonb;
    v_memory jsonb;
    v_actions jsonb;
    v_evidence jsonb;
    v_roadmap_id uuid;
    v_class_id uuid;
    v_subject_summaries jsonb;
    v_top_weak jsonb;
    v_ready_to_learn jsonb;
    v_total_kcs bigint;
    v_mean_mastery numeric;
    v_median_conf numeric;
    v_topics_at_risk bigint;
    v_active_misconceptions bigint;
    v_vel_tier text;
BEGIN
    SELECT COALESCE(MAX(snapshot_version), 0) + 1
    INTO v_next_version
    FROM public.student_twin_snapshots
    WHERE user_id = p_user_id;

    SELECT id, class_id INTO v_roadmap_id, v_class_id
    FROM public.student_roadmaps
    WHERE user_id = p_user_id
    ORDER BY updated_at DESC
    LIMIT 1;

    -- Behavioral
    SELECT jsonb_build_object(
        'preferred_time', preferred_time, 'typical_duration_min', typical_session_duration_min,
        'subject_affinity', subject_affinity, 'fatigue_patterns', fatigue_patterns,
        'missed_days_streak', missed_days_streak, 'backlog_count', backlog_count,
        'attendance_risk_level', attendance_risk_level, 'stress_signals', stress_signals,
        'weak_subjects', weak_subjects, 'strong_subjects', strong_subjects,
        'last_emotional_state', last_emotional_state
    )
    INTO v_behavioral
    FROM public.student_behavioral_profiles
    WHERE user_id = p_user_id;

    -- Subject summaries (pre-aggregated to avoid nested aggregates)
    SELECT COALESCE(jsonb_agg(jsonb_build_object(
        'subject', subject, 'mastery_pct', mastery_pct, 'kc_count', kc_count,
        'weak_count', weak_count, 'ready_count', ready_count, 'mastered_count', mastered_count
    ) ORDER BY subject), '[]'::jsonb)
    INTO v_subject_summaries
    FROM (
        SELECT kc.subject,
            ROUND(AVG(stm.mastery_probability)::numeric, 3) as mastery_pct,
            COUNT(*) as kc_count,
            COUNT(*) FILTER (WHERE stm.mastery_probability < 0.4) as weak_count,
            COUNT(*) FILTER (WHERE stm.mastery_probability >= 0.7 AND stm.mastery_probability < 0.85) as ready_count,
            COUNT(*) FILTER (WHERE stm.mastery_probability >= 0.85) as mastered_count
        FROM public.student_topic_mastery stm
        JOIN public.knowledge_components kc ON kc.id = stm.kc_id
        WHERE stm.user_id = p_user_id
        GROUP BY kc.subject
    ) subj_agg;

    -- Top weak KCs
    SELECT COALESCE(jsonb_agg(jsonb_build_object(
        'kc_id', kc_id,
        'topic', (SELECT kc2.topic FROM public.knowledge_components kc2 WHERE kc2.id = t.kc_id),
        'mastery', ROUND(mastery_probability::numeric, 3),
        'retention', ROUND(predicted_retention::numeric, 3)
    )), '[]'::jsonb)
    INTO v_top_weak
    FROM (
        SELECT kc_id, mastery_probability, predicted_retention
        FROM public.student_topic_mastery
        WHERE user_id = p_user_id AND mastery_probability < 0.5
        ORDER BY mastery_probability ASC
        LIMIT 5
    ) t;

    -- Ready to learn
    SELECT COALESCE(jsonb_agg(jsonb_build_object(
        'kc_id', kc_id,
        'topic', (SELECT kc2.topic FROM public.knowledge_components kc2 WHERE kc2.id = t2.kc_id),
        'mastery', ROUND(mastery_probability::numeric, 3),
        'prereq_readiness', ROUND(prereq_readiness_score::numeric, 3)
    )), '[]'::jsonb)
    INTO v_ready_to_learn
    FROM (
        SELECT kc_id, mastery_probability, prereq_readiness_score
        FROM public.student_topic_mastery
        WHERE user_id = p_user_id AND mastery_probability < 0.7 AND prereq_readiness_score >= 0.7
        ORDER BY mastery_probability DESC
        LIMIT 5
    ) t2;

    v_mastery := jsonb_build_object(
        'subject_summaries', v_subject_summaries,
        'top_weak_kcs', v_top_weak,
        'ready_to_learn', v_ready_to_learn
    );

    -- Cognitive metrics
    SELECT COUNT(*), ROUND(AVG(mastery_probability)::numeric, 3)
    INTO v_total_kcs, v_mean_mastery
    FROM public.student_topic_mastery
    WHERE user_id = p_user_id;

    SELECT ROUND(PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY confidence)::numeric, 3)
    INTO v_median_conf
    FROM public.student_topic_mastery
    WHERE user_id = p_user_id;

    SELECT COUNT(*) INTO v_topics_at_risk
    FROM public.student_topic_mastery 
    WHERE user_id = p_user_id AND predicted_retention < 0.3 AND mastery_probability > 0.3;

    SELECT COUNT(*) INTO v_active_misconceptions
    FROM public.student_misconceptions 
    WHERE user_id = p_user_id AND resolved = false;

    SELECT COALESCE(mode() WITHIN GROUP (ORDER BY velocity_tier), 'unknown')
    INTO v_vel_tier
    FROM public.student_learning_velocity
    WHERE user_id = p_user_id;

    v_cognitive := jsonb_build_object(
        'total_kcs_tracked', v_total_kcs,
        'mean_mastery', COALESCE(v_mean_mastery, 0),
        'median_confidence', COALESCE(v_median_conf, 0),
        'topics_at_risk', v_topics_at_risk,
        'active_misconceptions', v_active_misconceptions,
        'velocity_tier', v_vel_tier
    );

    -- Motivation
    SELECT jsonb_build_object(
        'current_streak_days', COALESCE((
            SELECT GREATEST(0, COUNT(DISTINCT scheduled_date)::int)
            FROM public.task_completions_v2
            WHERE user_id = p_user_id AND scheduled_date >= CURRENT_DATE - interval '14 days'
        ), 0),
        'active_avoidance_patterns', (
            SELECT COUNT(*) FROM public.student_avoidance_patterns 
            WHERE user_id = p_user_id AND active = true AND pattern_label IN ('chronic_avoider', 'consistent_avoider')
        ),
        'engagement_trend', 'stable',
        'backlog_size', COALESCE((SELECT backlog_count FROM public.student_behavioral_profiles WHERE user_id = p_user_id), 0)
    )
    INTO v_motivation;

    -- Memory
    SELECT COALESCE(jsonb_object_agg(key, jsonb_build_object('value', value, 'confidence', confidence, 'last_seen', last_seen_at)), '{}')
    INTO v_memory
    FROM public.user_memory
    WHERE user_id = p_user_id;

    -- Actions
    SELECT COALESCE(jsonb_agg(jsonb_build_object('action_type', action_type, 'priority', ord) ORDER BY ord), '[]')
    INTO v_actions
    FROM (
        SELECT action_type, row_number() OVER () as ord
        FROM (
            SELECT 'practice_weak_kc' AS action_type 
            WHERE EXISTS (SELECT 1 FROM public.student_topic_mastery WHERE user_id = p_user_id AND mastery_probability < 0.4)
            UNION ALL
            SELECT 'clear_backlog' 
            WHERE EXISTS (SELECT 1 FROM public.student_behavioral_profiles WHERE user_id = p_user_id AND backlog_count > 3)
            UNION ALL
            SELECT 'address_misconception'
            WHERE EXISTS (SELECT 1 FROM public.student_misconceptions WHERE user_id = p_user_id AND resolved = false)
            UNION ALL
            SELECT 'spaced_review'
            WHERE EXISTS (SELECT 1 FROM public.student_topic_mastery WHERE user_id = p_user_id AND predicted_retention < 0.5 AND mastery_probability > 0.6)
            UNION ALL
            SELECT 'maintain_streak'
            WHERE EXISTS (SELECT 1 FROM public.student_behavioral_profiles WHERE user_id = p_user_id AND missed_days_streak > 0)
        ) sub
    ) ranked;

    -- Evidence
    SELECT jsonb_build_array(
        jsonb_build_object('table', 'student_behavioral_profiles', 'row_count', (SELECT COUNT(*) FROM public.student_behavioral_profiles WHERE user_id = p_user_id), 'weight', 0.2),
        jsonb_build_object('table', 'student_topic_mastery', 'row_count', (SELECT COUNT(*) FROM public.student_topic_mastery WHERE user_id = p_user_id), 'weight', 0.3),
        jsonb_build_object('table', 'student_cognitive_profiles', 'row_count', (SELECT COUNT(*) FROM public.student_cognitive_profiles WHERE user_id = p_user_id), 'weight', 0.15),
        jsonb_build_object('table', 'user_memory', 'row_count', (SELECT COUNT(*) FROM public.user_memory WHERE user_id = p_user_id), 'weight', 0.15),
        jsonb_build_object('table', 'task_completions_v2', 'row_count', (SELECT COUNT(*) FROM public.task_completions_v2 WHERE user_id = p_user_id), 'weight', 0.2)
    )
    INTO v_evidence;

    INSERT INTO public.student_twin_snapshots (
        user_id, snapshot_at, snapshot_version, current_roadmap_id, current_class_id,
        behavioral_profile, mastery_landscape, cognitive_state, motivation_state,
        persistent_memory, recommended_next_actions, evidence_sources, twin_completeness_score
    ) VALUES (
        p_user_id, now(), v_next_version, v_roadmap_id, v_class_id,
        COALESCE(v_behavioral, '{}'), COALESCE(v_mastery, '{}'), COALESCE(v_cognitive, '{}'),
        COALESCE(v_motivation, '{}'), COALESCE(v_memory, '{}'), COALESCE(v_actions, '[]'),
        COALESCE(v_evidence, '[]'),
        LEAST(1.0, (
            (CASE WHEN v_behavioral IS NOT NULL AND v_behavioral != '{}' THEN 0.2 ELSE 0 END) +
            (CASE WHEN v_mastery IS NOT NULL AND v_mastery != '{}' THEN 0.3 ELSE 0 END) +
            (CASE WHEN v_cognitive IS NOT NULL AND v_cognitive != '{}' THEN 0.2 ELSE 0 END) +
            (CASE WHEN v_motivation IS NOT NULL AND v_motivation != '{}' THEN 0.15 ELSE 0 END) +
            (CASE WHEN v_memory IS NOT NULL AND v_memory != '{}' THEN 0.15 ELSE 0 END)
        ))
    )
    RETURNING id INTO v_snapshot_id;

    RETURN v_snapshot_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================
-- refresh_all_student_twins
-- ============================================================
CREATE OR REPLACE FUNCTION public.refresh_all_student_twins()
RETURNS TABLE(user_id uuid, snapshot_id uuid, success boolean) AS $$
DECLARE
    r RECORD;
    v_snapshot_id uuid;
BEGIN
    FOR r IN SELECT DISTINCT u.id FROM auth.users u
             WHERE EXISTS (SELECT 1 FROM public.student_roadmaps sr WHERE sr.user_id = u.id)
    LOOP
        BEGIN
            v_snapshot_id := public.refresh_student_twin_snapshot(r.id);
            RETURN QUERY SELECT r.id, v_snapshot_id, true;
        EXCEPTION WHEN OTHERS THEN
            RETURN QUERY SELECT r.id, null::uuid, false;
        END;
    END LOOP;
    RETURN;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================
-- generate_weekly_summary
-- ============================================================
CREATE OR REPLACE FUNCTION public.generate_weekly_summary(
    p_user_id uuid,
    p_week_start date DEFAULT DATE_TRUNC('week', CURRENT_DATE)::date
)
RETURNS uuid AS $$
DECLARE
    v_summary_id uuid;
    v_week_end date := p_week_start + 6;
    v_total_minutes integer;
    v_tasks_completed integer;
    v_tasks_assigned integer;
    v_tests_taken integer;
    v_avg_score numeric;
    v_subjects_studied text[];
    v_for_student jsonb;
    v_for_teacher jsonb;
    v_for_parent jsonb;
    v_raw_metrics jsonb;
BEGIN
    SELECT COALESCE(SUM(actual_duration_min), 0)::integer, COUNT(*)
    INTO v_total_minutes, v_tasks_completed
    FROM public.task_completions_v2
    WHERE user_id = p_user_id
    AND scheduled_date >= p_week_start AND scheduled_date <= v_week_end;

    SELECT COUNT(*) INTO v_tasks_assigned
    FROM public.plan_tasks pt
    JOIN public.exam_plans ep ON ep.id = pt.plan_id
    WHERE ep.user_id = p_user_id
    AND pt.task_date >= p_week_start AND pt.task_date <= v_week_end;

    SELECT COUNT(*) INTO v_tests_taken
    FROM public.practice_test_attempts
    WHERE user_id = p_user_id
    AND completed_at >= p_week_start AND completed_at < (v_week_end + 1);

    SELECT ROUND(AVG(score::numeric / NULLIF(total_questions, 0) * 100), 1)
    INTO v_avg_score
    FROM public.practice_test_attempts
    WHERE user_id = p_user_id
    AND completed_at >= p_week_start AND completed_at < (v_week_end + 1)
    AND total_questions > 0;

    SELECT ARRAY_AGG(DISTINCT subject) INTO v_subjects_studied
    FROM public.task_completions_v2
    WHERE user_id = p_user_id
    AND scheduled_date >= p_week_start AND scheduled_date <= v_week_end
    AND subject IS NOT NULL;

    v_raw_metrics := jsonb_build_object(
        'study_minutes_total', v_total_minutes,
        'tasks_completed', v_tasks_completed,
        'tasks_assigned', v_tasks_assigned,
        'tests_taken', v_tests_taken,
        'avg_test_score', COALESCE(v_avg_score, 0),
        'subjects_studied', COALESCE(v_subjects_studied, ARRAY[]::text[]),
        'week_start', p_week_start,
        'week_end', v_week_end
    );

    SELECT jsonb_build_object(
        'headline', CASE 
            WHEN v_tasks_completed >= v_tasks_assigned * 0.8 THEN 'Great week! You stayed on track.'
            WHEN v_tasks_completed >= v_tasks_assigned * 0.5 THEN 'Solid progress. A few tasks remain.'
            ELSE 'Let''s get back on track together.'
        END,
        'tasks_done', v_tasks_completed,
        'tasks_total', v_tasks_assigned,
        'study_hours', ROUND(v_total_minutes / 60.0, 1),
        'subjects', v_subjects_studied,
        'top_tip', COALESCE((
            SELECT CASE 
                WHEN missed_days_streak > 2 THEN 'Start with a 10-minute warm-up to rebuild momentum.'
                WHEN backlog_count > 5 THEN 'Consider a catch-up session this weekend.'
                ELSE 'Keep your current rhythm!'
            END
            FROM public.student_behavioral_profiles
            WHERE user_id = p_user_id
        ), 'Keep studying!')
    )
    INTO v_for_student;

    SELECT jsonb_build_object(
        'at_risk', COALESCE(
            (SELECT missed_days_streak > 3 OR backlog_count > 5 OR attendance_risk_level = 'high'
             FROM public.student_behavioral_profiles WHERE user_id = p_user_id),
            false
        ),
        'attendance_summary', v_tasks_completed || '/' || v_tasks_assigned || ' tasks done',
        'struggling_topics', COALESCE((
            SELECT jsonb_agg(jsonb_build_object('topic', kc.topic, 'mastery', ROUND(stm.mastery_probability::numeric, 2)))
            FROM public.student_topic_mastery stm
            JOIN public.knowledge_components kc ON kc.id = stm.kc_id
            WHERE stm.user_id = p_user_id AND stm.mastery_probability < 0.4
            LIMIT 5
        ), '[]'::jsonb),
        'avg_test_score', v_avg_score
    )
    INTO v_for_teacher;

    SELECT jsonb_build_object(
        'headline', CASE 
            WHEN v_tasks_completed >= v_tasks_assigned * 0.8 THEN 'Your child had a strong study week.'
            WHEN v_tasks_completed >= v_tasks_assigned * 0.5 THEN 'Steady effort this week.'
            ELSE 'They may need some encouragement to get back on track.'
        END,
        'study_hours', ROUND(v_total_minutes / 60.0, 1),
        'subjects', v_subjects_studied,
        'tests_taken', v_tests_taken,
        'suggested_support', CASE 
            WHEN v_tasks_completed < v_tasks_assigned * 0.5 THEN jsonb_build_array('Check schedule conflicts', 'Offer a quiet study space')
            ELSE jsonb_build_array('Celebrate consistency!')
        END
    )
    INTO v_for_parent;

    INSERT INTO public.student_twin_summaries (
        user_id, week_start, week_end, for_student, for_teacher, for_parent, raw_metrics, generated_by
    ) VALUES (
        p_user_id, p_week_start, v_week_end, v_for_student, v_for_teacher, v_for_parent, v_raw_metrics, 'system'
    )
    ON CONFLICT (user_id, week_start) DO UPDATE SET
        for_student = EXCLUDED.for_student,
        for_teacher = EXCLUDED.for_teacher,
        for_parent = EXCLUDED.for_parent,
        raw_metrics = EXCLUDED.raw_metrics,
        updated_at = now()
    RETURNING id INTO v_summary_id;

    RETURN v_summary_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================
-- compute_task_rationale
-- ============================================================
CREATE OR REPLACE FUNCTION public.compute_task_rationale(
    p_user_id uuid,
    p_task_source_type text,
    p_task_source_id uuid,
    p_task_title text DEFAULT NULL
)
RETURNS uuid AS $$
DECLARE
    v_rationale_id uuid;
    v_rationale_type text;
    v_explanation text;
    v_grounding jsonb;
    v_tone text := 'encouraging';
    v_kc_id uuid;
    v_mastery numeric;
    v_prereq_ready numeric;
    v_subject text;
    v_avoidance_exists boolean;
BEGIN
    IF p_task_source_type = 'plan_task' THEN
        SELECT topic INTO v_subject FROM public.plan_tasks WHERE id = p_task_source_id;
    ELSIF p_task_source_type = 'curriculum_task' THEN
        SELECT subject INTO v_subject FROM public.curriculum_tasks WHERE id = p_task_source_id;
    END IF;

    SELECT stm.kc_id, stm.mastery_probability, stm.prereq_readiness_score
    INTO v_kc_id, v_mastery, v_prereq_ready
    FROM public.student_topic_mastery stm
    JOIN public.knowledge_components kc ON kc.id = stm.kc_id
    WHERE stm.user_id = p_user_id
    AND (kc.subject = v_subject OR v_subject IS NULL)
    ORDER BY stm.mastery_probability ASC
    LIMIT 1;

    SELECT EXISTS (
        SELECT 1 FROM public.student_avoidance_patterns
        WHERE user_id = p_user_id AND active = true
        AND (subject = v_subject OR task_type = p_task_source_type)
        AND pattern_label IN ('chronic_avoider', 'consistent_avoider')
    ) INTO v_avoidance_exists;

    IF v_avoidance_exists THEN
        v_rationale_type := 'avoidance_confront';
        v_explanation := 'You have been skipping tasks like this. This short session is designed to rebuild confidence. ' ||
            'Small wins here will make the next ones feel easier.';
        v_grounding := jsonb_build_object(
            'evidence_table', 'student_avoidance_patterns',
            'subject', v_subject, 'task_type', p_task_source_type, 'pattern', 'avoidance_detected'
        );
    ELSIF v_mastery IS NOT NULL AND v_mastery < 0.4 THEN
        v_rationale_type := 'mastery_building';
        v_explanation := 'This builds your foundation in ' || COALESCE(v_subject, 'this topic') || '. ' ||
            'Your current mastery is ' || ROUND(v_mastery::numeric * 100, 0) || '%, ' ||
            'so focused practice here will give you the biggest gains.';
        v_grounding := jsonb_build_object(
            'evidence_table', 'student_topic_mastery',
            'evidence_kc_id', v_kc_id, 'evidence_mastery', v_mastery, 'subject', v_subject
        );
    ELSIF v_prereq_ready IS NOT NULL AND v_prereq_ready >= 0.7 AND v_mastery < 0.7 THEN
        v_rationale_type := 'prerequisite_gap';
        v_explanation := 'You are ready for this! Your prerequisite knowledge is strong (' || 
            ROUND(v_prereq_ready::numeric * 100, 0) || '% ready), so this task is the perfect next step.';
        v_grounding := jsonb_build_object(
            'evidence_table', 'student_topic_mastery',
            'evidence_prereq_readiness', v_prereq_ready, 'evidence_mastery', v_mastery
        );
    ELSIF EXISTS (SELECT 1 FROM public.student_misconceptions WHERE user_id = p_user_id AND resolved = false) THEN
        v_rationale_type := 'misconception_repair';
        v_explanation := 'This targets a specific gap we noticed in your recent work. Clearing this up will make the next topics much easier.';
        v_grounding := jsonb_build_object(
            'evidence_table', 'student_misconceptions',
            'active_misconceptions', (SELECT COUNT(*) FROM public.student_misconceptions WHERE user_id = p_user_id AND resolved = false)
        );
    ELSE
        v_rationale_type := 'spaced_repetition';
        v_explanation := 'This keeps your knowledge fresh. Spaced review is one of the most effective study techniques.';
        v_grounding := jsonb_build_object('evidence_table', 'system_default', 'reason', 'maintenance');
    END IF;

    SELECT COALESCE(CASE 
        WHEN stress_signals ? 'high_anxiety' THEN 'gentle'
        WHEN missed_days_streak > 2 THEN 'encouraging'
        WHEN response_to_failure = 'quits' THEN 'gentle'
        ELSE 'direct'
    END, 'encouraging') INTO v_tone
    FROM public.student_behavioral_profiles
    WHERE user_id = p_user_id;

    INSERT INTO public.task_rationales (
        user_id, task_source_type, task_source_id, task_title,
        rationale_type, explanation_text, explanation_short, tone, grounding, valid_from
    ) VALUES (
        p_user_id, p_task_source_type, p_task_source_id, COALESCE(p_task_title, v_subject),
        v_rationale_type, v_explanation,
        LEFT(v_explanation, 120) || CASE WHEN LENGTH(v_explanation) > 120 THEN '...' ELSE '' END,
        v_tone, v_grounding, now()
    )
    ON CONFLICT (user_id, task_source_type, task_source_id, valid_from) DO UPDATE SET
        rationale_type = EXCLUDED.rationale_type,
        explanation_text = EXCLUDED.explanation_text,
        explanation_short = EXCLUDED.explanation_short,
        tone = EXCLUDED.tone,
        grounding = EXCLUDED.grounding,
        valid_until = null,
        updated_at = now()
    RETURNING id INTO v_rationale_id;

    RETURN v_rationale_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================
-- refresh_student_twin_full (convenience wrapper)
-- ============================================================
CREATE OR REPLACE FUNCTION public.refresh_student_twin_full(p_user_id uuid)
RETURNS jsonb AS $$
DECLARE
    v_snapshot_id uuid;
    v_summary_id uuid;
BEGIN
    PERFORM public.refresh_derived_metrics();
    v_snapshot_id := public.refresh_student_twin_snapshot(p_user_id);
    v_summary_id := public.generate_weekly_summary(p_user_id);
    RETURN jsonb_build_object('snapshot_id', v_snapshot_id, 'summary_id', v_summary_id, 'refreshed_at', now());
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
