import type { SupabaseClient } from '@supabase/supabase-js';
import { listEvents, createEvent } from '@/services/calendar';
import { youtubeSearch } from '@/lib/integrations/youtube';
import { spotifySearch } from '@/lib/integrations/spotify';

/**
 * Implementations for every LOW/MEDIUM tool in the registry.
 * HIGH/CRITICAL tools never reach this file — services/assistant.ts converts
 * them into pending approvals before execution.
 */
export async function runTool(
  supabase: SupabaseClient,
  userId: string,
  name: string,
  input: Record<string, unknown>
): Promise<string> {
  switch (name) {
    // === Tasks ================================================================
    case 'create_task': {
      const { data, error } = await supabase
        .from('tasks')
        .insert({
          user_id: userId,
          title: String(input.title ?? '').slice(0, 500),
          notes: input.notes ? String(input.notes) : null,
          priority: ['low', 'medium', 'high'].includes(String(input.priority))
            ? String(input.priority)
            : 'medium',
          due_at: input.due_at ? new Date(String(input.due_at)).toISOString() : null,
          project_id: input.project_id ? String(input.project_id) : null,
        })
        .select('id, title, due_at, priority, project_id')
        .single();
      if (error) throw new Error(error.message);
      return `Task created: ${JSON.stringify(data)}`;
    }

    case 'list_tasks': {
      const status = String(input.status ?? 'pending');
      let query = supabase
        .from('tasks')
        .select('id, title, notes, status, priority, due_at, project_id')
        .eq('user_id', userId)
        .order('due_at', { ascending: true, nullsFirst: false })
        .limit(50);
      if (status !== 'all') query = query.eq('status', status);
      if (input.project_id) query = query.eq('project_id', String(input.project_id));
      const { data, error } = await query;
      if (error) throw new Error(error.message);
      return data?.length ? JSON.stringify(data) : 'No tasks found.';
    }

    case 'complete_task': {
      const { data, error } = await supabase
        .from('tasks')
        .update({ status: 'completed', completed_at: new Date().toISOString() })
        .eq('id', String(input.task_id))
        .eq('user_id', userId)
        .select('id, title')
        .single();
      if (error) throw new Error(error.message);
      return `Task completed: ${data.title}`;
    }

    // === Memory ===============================================================
    case 'save_memory': {
      const { data, error } = await supabase
        .from('memories')
        .insert({
          user_id: userId,
          content: String(input.content ?? '').slice(0, 2000),
          category: String(input.category ?? 'general'),
          source: 'assistant',
        })
        .select('id')
        .single();
      if (error) throw new Error(error.message);
      return `Memory saved (id ${data.id}).`;
    }

    case 'search_memory': {
      const query = String(input.query ?? '').trim();
      if (!query) return 'Empty query.';
      const { data, error } = await supabase
        .from('memories')
        .select('id, content, category, created_at')
        .eq('user_id', userId)
        .or(`content.ilike.%${query.replaceAll('%', '').replaceAll(',', ' ')}%`)
        .order('created_at', { ascending: false })
        .limit(20);
      if (error) throw new Error(error.message);
      return data?.length ? JSON.stringify(data) : 'No memories matched.';
    }

    case 'list_memories': {
      const { data, error } = await supabase
        .from('memories')
        .select('id, content, category, created_at')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(50);
      if (error) throw new Error(error.message);
      return data?.length ? JSON.stringify(data) : 'No memories stored.';
    }

    // === Calendar =============================================================
    case 'list_events': {
      const from = input.from ? new Date(String(input.from)) : new Date();
      const to = input.to
        ? new Date(String(input.to))
        : new Date(from.getTime() + 14 * 24 * 60 * 60 * 1000);
      const events = await listEvents(supabase, userId, {
        from: from.toISOString(),
        to: to.toISOString(),
      });
      return events.length ? JSON.stringify(events) : 'No events in that range.';
    }

    case 'create_event': {
      const event = await createEvent(supabase, userId, {
        title: String(input.title ?? ''),
        starts_at: String(input.starts_at ?? ''),
        ends_at: input.ends_at ? String(input.ends_at) : null,
        description: input.description ? String(input.description) : null,
        location: input.location ? String(input.location) : null,
        all_day: Boolean(input.all_day),
      });
      return `Event created (${event.source}): ${JSON.stringify(event)}`;
    }

    // === CRM (clients & quotes) ==============================================
    case 'list_clients': {
      const status = String(input.status ?? 'all');
      let query = supabase
        .from('clients')
        .select('id, name, company, email, phone, status, notes')
        .eq('user_id', userId)
        .order('name', { ascending: true })
        .limit(100);
      if (status !== 'all') query = query.eq('status', status);
      if (input.query) {
        const q = String(input.query).replaceAll('%', '').replaceAll(',', ' ');
        query = query.or(`name.ilike.%${q}%,company.ilike.%${q}%`);
      }
      const { data, error } = await query;
      if (error) throw new Error(error.message);
      return data?.length ? JSON.stringify(data) : 'No clients found.';
    }

    case 'create_client': {
      const { data, error } = await supabase
        .from('clients')
        .insert({
          user_id: userId,
          name: String(input.name ?? '').slice(0, 200),
          company: input.company ? String(input.company) : null,
          email: input.email ? String(input.email) : null,
          phone: input.phone ? String(input.phone) : null,
          notes: input.notes ? String(input.notes) : null,
          status: ['lead', 'active'].includes(String(input.status)) ? String(input.status) : 'lead',
        })
        .select('id, name, company, status')
        .single();
      if (error) throw new Error(error.message);
      return `Client created: ${JSON.stringify(data)}`;
    }

    case 'create_quote': {
      const { data: client } = await supabase
        .from('clients')
        .select('id, name')
        .eq('id', String(input.client_id))
        .eq('user_id', userId)
        .single();
      if (!client) throw new Error('Client not found — use list_clients or create_client first');

      const { data, error } = await supabase
        .from('quotes')
        .insert({
          user_id: userId,
          client_id: client.id,
          title: String(input.title ?? '').slice(0, 300),
          content: String(input.content ?? '').slice(0, 20000),
          amount: typeof input.amount === 'number' ? input.amount : null,
          currency: input.currency ? String(input.currency).slice(0, 3).toUpperCase() : 'USD',
        })
        .select('id, title, amount, currency, status')
        .single();
      if (error) throw new Error(error.message);
      return `Quote draft created for ${client.name}: ${JSON.stringify(data)}. The user reviews it in the Clients view.`;
    }

    case 'list_quotes': {
      const status = String(input.status ?? 'all');
      let query = supabase
        .from('quotes')
        .select('id, client_id, title, amount, currency, status, created_at')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(50);
      if (status !== 'all') query = query.eq('status', status);
      if (input.client_id) query = query.eq('client_id', String(input.client_id));
      const { data, error } = await query;
      if (error) throw new Error(error.message);
      return data?.length ? JSON.stringify(data) : 'No quotes found.';
    }

    // === Leads ================================================================
    case 'create_lead': {
      const { data, error } = await supabase
        .from('leads')
        .insert({
          user_id: userId,
          name: String(input.name ?? '').slice(0, 200),
          contact: input.contact ? String(input.contact) : null,
          source: [
            'instagram', 'youtube', 'webinar', 'ttp', 'referral', 'website', 'other',
          ].includes(String(input.source))
            ? String(input.source)
            : 'other',
          segment: input.segment ? String(input.segment) : null,
          interest: input.interest ? String(input.interest) : null,
          value_estimate: typeof input.value_estimate === 'number' ? input.value_estimate : null,
          notes: input.notes ? String(input.notes) : null,
        })
        .select('id, name, source, segment, status')
        .single();
      if (error) throw new Error(error.message);
      return `Lead created: ${JSON.stringify(data)}`;
    }

    case 'list_leads': {
      const status = String(input.status ?? 'all');
      let query = supabase
        .from('leads')
        .select(
          'id, name, contact, source, segment, interest, value_estimate, currency, status, notes, last_contact_at, updated_at'
        )
        .eq('user_id', userId)
        .order('updated_at', { ascending: false })
        .limit(100);
      if (status !== 'all') query = query.eq('status', status);
      if (input.source) query = query.eq('source', String(input.source));
      if (input.segment) query = query.eq('segment', String(input.segment));
      const { data, error } = await query;
      if (error) throw new Error(error.message);
      return data?.length ? JSON.stringify(data) : 'No leads found.';
    }

    case 'update_lead': {
      const update: Record<string, unknown> = {};
      if (
        ['new', 'contacted', 'qualified', 'proposal', 'won', 'lost'].includes(String(input.status))
      )
        update.status = input.status;
      if (input.segment !== undefined) update.segment = input.segment ? String(input.segment) : null;
      if (input.interest !== undefined)
        update.interest = input.interest ? String(input.interest) : null;
      if (typeof input.value_estimate === 'number') update.value_estimate = input.value_estimate;
      if (input.notes !== undefined) update.notes = input.notes ? String(input.notes) : null;
      if (input.touched === true) update.last_contact_at = new Date().toISOString();
      if (Object.keys(update).length === 0) throw new Error('Nothing to update');

      const { data, error } = await supabase
        .from('leads')
        .update(update)
        .eq('id', String(input.lead_id))
        .eq('user_id', userId)
        .select('id, name, status, segment')
        .single();
      if (error) throw new Error(error.message);
      return `Lead updated: ${JSON.stringify(data)}`;
    }

    // === Projects =============================================================
    case 'create_project': {
      const { data, error } = await supabase
        .from('projects')
        .insert({
          user_id: userId,
          name: String(input.name ?? '').slice(0, 300),
          kind: ['reel', 'video', 'campaign', 'webinar', 'automation', 'other'].includes(
            String(input.kind)
          )
            ? String(input.kind)
            : 'other',
          client_id: input.client_id ? String(input.client_id) : null,
          due_at: input.due_at ? new Date(String(input.due_at)).toISOString() : null,
          notes: input.notes ? String(input.notes) : null,
        })
        .select('id, name, kind, status, due_at')
        .single();
      if (error) throw new Error(error.message);
      return `Project created: ${JSON.stringify(data)}. Now add phase tasks with create_task + project_id.`;
    }

    case 'list_projects': {
      const status = String(input.status ?? 'all');
      let query = supabase
        .from('projects')
        .select('id, client_id, name, kind, status, due_at, notes, updated_at')
        .eq('user_id', userId)
        .order('due_at', { ascending: true, nullsFirst: false })
        .limit(100);
      if (status !== 'all') query = query.eq('status', status);
      const { data, error } = await query;
      if (error) throw new Error(error.message);
      return data?.length ? JSON.stringify(data) : 'No projects found.';
    }

    case 'update_project': {
      const update: Record<string, unknown> = {};
      if (
        ['planning', 'production', 'post', 'review', 'delivered', 'archived'].includes(
          String(input.status)
        )
      )
        update.status = input.status;
      if (input.due_at !== undefined)
        update.due_at = input.due_at ? new Date(String(input.due_at)).toISOString() : null;
      if (input.notes !== undefined) update.notes = input.notes ? String(input.notes) : null;
      if (Object.keys(update).length === 0) throw new Error('Nothing to update');

      const { data, error } = await supabase
        .from('projects')
        .update(update)
        .eq('id', String(input.project_id))
        .eq('user_id', userId)
        .select('id, name, status, due_at')
        .single();
      if (error) throw new Error(error.message);
      return `Project updated: ${JSON.stringify(data)}`;
    }

    // === Contents =============================================================
    case 'save_content': {
      const validTypes = [
        'idea', 'hook', 'script', 'caption', 'thumbnail', 'calendar',
        'report', 'reference', 'playlist', 'email', 'post', 'sop',
      ];
      const type = String(input.type ?? '');
      if (!validTypes.includes(type)) throw new Error(`Invalid content type "${type}"`);
      const { data, error } = await supabase
        .from('contents')
        .insert({
          user_id: userId,
          type,
          title: String(input.title ?? '').slice(0, 300),
          body: String(input.body ?? '').slice(0, 50000),
          platform: input.platform ? String(input.platform) : null,
          source_url: input.source_url ? String(input.source_url) : null,
          project_id: input.project_id ? String(input.project_id) : null,
        })
        .select('id, type, title')
        .single();
      if (error) throw new Error(error.message);
      return `Content saved: ${JSON.stringify(data)}. The user reviews it in the matching workspace.`;
    }

    case 'list_contents': {
      let query = supabase
        .from('contents')
        .select('id, type, title, platform, source_url, status, project_id, created_at')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(50);
      if (input.type) query = query.eq('type', String(input.type));
      if (input.platform) query = query.eq('platform', String(input.platform));
      if (input.query) {
        query = query.ilike('title', `%${String(input.query).replaceAll('%', '')}%`);
      }
      const { data, error } = await query;
      if (error) throw new Error(error.message);
      return data?.length ? JSON.stringify(data) : 'No contents found.';
    }

    // === Metrics ==============================================================
    case 'log_content_metrics': {
      const numeric = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? v : null);
      const { data, error } = await supabase
        .from('content_metrics')
        .insert({
          user_id: userId,
          content_id: input.content_id ? String(input.content_id) : null,
          platform: String(input.platform ?? 'instagram'),
          ref: input.ref ? String(input.ref) : null,
          views: numeric(input.views),
          likes: numeric(input.likes),
          comments: numeric(input.comments),
          shares: numeric(input.shares),
          saves: numeric(input.saves),
          follows: numeric(input.follows),
          watch_seconds: numeric(input.watch_seconds),
          posted_at: input.posted_at ? new Date(String(input.posted_at)).toISOString() : null,
          notes: input.notes ? String(input.notes) : null,
        })
        .select('id, platform, views')
        .single();
      if (error) throw new Error(error.message);
      return `Metrics logged: ${JSON.stringify(data)}`;
    }

    case 'list_content_metrics': {
      const limit = typeof input.limit === 'number' ? Math.min(input.limit, 100) : 30;
      let query = supabase
        .from('content_metrics')
        .select('*')
        .eq('user_id', userId)
        .order('posted_at', { ascending: false, nullsFirst: false })
        .limit(limit);
      if (input.platform) query = query.eq('platform', String(input.platform));
      const { data, error } = await query;
      if (error) throw new Error(error.message);
      return data?.length ? JSON.stringify(data) : 'No metrics recorded yet.';
    }

    // === External research ====================================================
    case 'youtube_search': {
      const results = await youtubeSearch(
        String(input.query ?? ''),
        typeof input.max_results === 'number' ? input.max_results : 10,
        ['relevance', 'viewCount', 'date'].includes(String(input.order))
          ? (String(input.order) as 'relevance' | 'viewCount' | 'date')
          : 'relevance'
      );
      return results.length ? JSON.stringify(results) : 'No videos found.';
    }

    case 'spotify_search': {
      const results = await spotifySearch(
        String(input.query ?? ''),
        typeof input.limit === 'number' ? input.limit : 10
      );
      return results.length
        ? `${JSON.stringify(results)}\n\nREMINDER: Spotify tracks are NOT licensed for commercial video use.`
        : 'No tracks found.';
    }

    // === System ===============================================================
    case 'list_pending_approvals': {
      const { data, error } = await supabase
        .from('commands')
        .select('id, action, description, risk, created_at')
        .eq('user_id', userId)
        .eq('status', 'pending')
        .order('created_at', { ascending: false })
        .limit(20);
      if (error) throw new Error(error.message);
      return data?.length ? JSON.stringify(data) : 'No pending approvals.';
    }

    default:
      throw new Error(`Unknown tool "${name}"`);
  }
}
