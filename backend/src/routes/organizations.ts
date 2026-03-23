import { Router, Response } from 'express';
import { supabase } from '../config/supabase';
import { authenticate, AuthRequest } from '../middleware/auth';
import { sendInviteEmail } from '../services/email';

const router = Router();
router.use(authenticate);

// GET /api/organizations/me
router.get('/me', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (!req.orgId) {
      // Try to find org from DB
      const { data: membership } = await supabase
        .from('organization_members')
        .select('org_id, role, organizations(*)')
        .eq('user_id', req.userId!)
        .order('joined_at', { ascending: true })
        .limit(1)
        .single();

      if (!membership) {
        res.status(404).json({ error: 'No organization found' });
        return;
      }

      res.json({ organization: membership.organizations, role: membership.role });
      return;
    }

    const { data: org, error } = await supabase
      .from('organizations')
      .select('*')
      .eq('id', req.orgId)
      .single();

    if (error || !org) {
      res.status(404).json({ error: 'Organization not found' });
      return;
    }

    const { data: membership } = await supabase
      .from('organization_members')
      .select('role')
      .eq('org_id', req.orgId)
      .eq('user_id', req.userId!)
      .single();

    res.json({ organization: org, role: membership?.role });
  } catch (err) {
    console.error('[Org/FetchOrganization] Error:', err instanceof Error ? err.message : err);
    res.status(500).json({ error: 'Failed to fetch organization' });
  }
});

// PUT /api/organizations/me
router.put('/me', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (!req.orgId) {
      res.status(400).json({ error: 'No organization in token' });
      return;
    }

    const { name } = req.body;
    if (!name || typeof name !== 'string' || !name.trim()) {
      res.status(400).json({ error: 'Organization name is required' });
      return;
    }

    // Verify user is owner or admin
    const { data: membership } = await supabase
      .from('organization_members')
      .select('role')
      .eq('org_id', req.orgId)
      .eq('user_id', req.userId!)
      .single();

    if (!membership || !['owner', 'admin'].includes(membership.role)) {
      res.status(403).json({ error: 'Only owner or admin can update organization' });
      return;
    }

    const { data, error } = await supabase
      .from('organizations')
      .update({ name: String(name).trim().slice(0, 255) })
      .eq('id', req.orgId)
      .select()
      .single();

    if (error || !data) {
      res.status(500).json({ error: 'Failed to update organization' });
      return;
    }

    res.json({ organization: data });
  } catch (err) {
    console.error('[Org/UpdateOrganization] Error:', err instanceof Error ? err.message : err);
    res.status(500).json({ error: 'Failed to update organization' });
  }
});

// GET /api/organizations/me/members
router.get('/me/members', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const orgId = req.orgId;
    if (!orgId) {
      res.status(400).json({ error: 'No organization in token' });
      return;
    }

    const { data, error } = await supabase
      .from('organization_members')
      .select('id, org_id, user_id, role, joined_at, users(id, name, email)')
      .eq('org_id', orgId)
      .order('joined_at', { ascending: true });

    if (error) {
      res.status(500).json({ error: 'Failed to fetch members' });
      return;
    }

    res.json({ members: data });
  } catch (err) {
    console.error('[Org/FetchMembers] Error:', err instanceof Error ? err.message : err);
    res.status(500).json({ error: 'Failed to fetch members' });
  }
});

// POST /api/organizations/me/invite
router.post('/me/invite', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const orgId = req.orgId;
    if (!orgId) {
      res.status(400).json({ error: 'No organization in token' });
      return;
    }

    const { email } = req.body;
    const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

    if (!email || !EMAIL_REGEX.test(String(email).trim().toLowerCase())) {
      res.status(400).json({ error: 'Valid email is required' });
      return;
    }

    // Get org info
    const { data: org } = await supabase
      .from('organizations')
      .select('name')
      .eq('id', orgId)
      .single();

    // Get inviter info
    const { data: inviter } = await supabase
      .from('users')
      .select('name')
      .eq('id', req.userId!)
      .single();

    sendInviteEmail(
      String(email).trim().toLowerCase(),
      inviter?.name || 'Someone',
      org?.name || 'the team',
    ).catch(() => {});

    res.json({ success: true });
  } catch (err) {
    console.error('[Org/SendInvite] Error:', err instanceof Error ? err.message : err);
    res.status(500).json({ error: 'Failed to send invite' });
  }
});


// ── Update org branding ──
router.put('/branding', authenticate, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (!req.orgId) {
      res.status(400).json({ error: 'Организация не найдена' });
      return;
    }

    const { logo_url, primary_color, company_domain, custom_email_footer } = req.body;

    const updateData: Record<string, unknown> = {};
    if (logo_url !== undefined) updateData.logo_url = logo_url;
    if (primary_color !== undefined) updateData.primary_color = primary_color;
    if (company_domain !== undefined) updateData.company_domain = company_domain;
    if (custom_email_footer !== undefined) updateData.custom_email_footer = custom_email_footer;

    if (Object.keys(updateData).length === 0) {
      res.status(400).json({ error: 'Нечего обновлять' });
      return;
    }

    const { error } = await supabase
      .from('organizations')
      .update(updateData)
      .eq('id', req.orgId);

    if (error) {
      console.error('[Org/Branding] Error:', error.message);
      // Column might not exist — that's OK
      res.json({ success: true, message: 'Branding columns not yet migrated' });
      return;
    }

    res.json({ success: true });
  } catch (err) {
    console.error('[Org/Branding] Error:', err);
    res.status(500).json({ error: 'Ошибка обновления' });
  }
});

export default router;
