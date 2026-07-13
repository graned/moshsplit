-- =============================================================================
-- MoshSplit — Seed Data
-- =============================================================================
-- Creates a single event: Wacken Open Air 2026
-- =============================================================================

-- Wacken Open Air 2026 event
INSERT INTO app.event (id, name, description, currency, status, created_by)
VALUES (
    '00000000-0000-0000-0000-000000000001',
    'Wacken Open Air 2026',
    'Heavy Metal Festival in Wacken, Germany - August 2026',
    'EUR',
    'active',
    '00000000-0000-0000-0000-000000000001'
)
ON CONFLICT (id) DO NOTHING;

-- Add banner image for Wacken
INSERT INTO app.event_image (id, event_id, url, alt_text, image_type, sort_order)
VALUES (
    '00000000-0000-0000-0000-000000000002',
    '00000000-0000-0000-0000-000000000001',
    'https://lh3.googleusercontent.com/pw/AP1GczPw1BAi5csXtB-3YMRBZnU9Hyp16svesp9MiuFnJbE6MTvxuOgNPXWysZahC2fExMAa4joeMXpN484akLcZRPGKQ-AMCyczAUHbsl3EqIiXqrcwNG2y7_E9u41xPUM03WBeJ3LIExWtRRWx4i4A4wYWvKrZkwktpQhhnG2x_ZA352552NhrbR6yVi-0tIo4LKQMPx04EuPu3OdLElHWFOWIXUFrWG7NVQ04cqyowFaLgQRrECEiIAougl0KhXkc_WIanL02XfY1uvrwvUlMKD0MRecAaETpXmnEKkHCUzAsKpkzC2J5p1mSVNLZbyuPohAZ7Sg8N791m8cNDd7FkTOoVv1RkXzq5IWWkWZxvujmeTLIVf2ayB2kRheeLfS0cjc12kxAKMcg3tDrPRad9YL4XxBggg3MXTUSuRLZ-SB4zbRZ2MVcagaSCeHlX6Mrfzu0rFcCC9nCvViqMXNHQ5dXYB_mzhrDWSuM4lUGealuYMVjICwCqV_Qug9l0GRFA-gs1n2dE7F1rxvIaRD9CQji3siIQShYlathovtyBhYx7X030nT1Bdqhp4rrprd0q956GplOAhNUesgf3ztCD4OtF04gwFRNDuiBeUNfHlY3mUCbRIuoZU_6Dr7O3EGCp62gG1wzAZHCn2M-E1Oje65DtMA7wy0qRAW8EBVjc4ALyD-PvsPwRnzYJ-HNU0JrNI834-B00xxtMvG3FGu-Nrxyj2s1ikB8d5ENyggkN42GeiCZKSPA-nG-NuLJ7AxahIn7Pk5_jvT7qu2O1Fd6zp-CPdI931n6KVW9Kl3vQ2LXVpAMRJwMIBe3RLgqub33k4KnhFu77bmhUMQz7V76hH6lQEsPV09S_EWx-in79vJQWniZC2dqtF6IIoOtxn1OvMzxntVq6LE_F-eCq_OGO5ZkPBUFxRAorSylueNmBphi0IFqZQTbVzF1og3vGfuy44W401d8cqQMvzQ=w360-h480-no?authuser=0',
    'Wacken Open Air 2026 - Heavy Metal Festival',
    'banner',
    1
)
ON CONFLICT DO NOTHING;
