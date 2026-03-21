import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { getSupabaseServerClient } from '@/lib/supabase-server';

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const supabase = getSupabaseServerClient();
  const { data, error } = await supabase
    .from('reports')
    .select('*')
    .eq('user_id', session.user.id)
    .eq('deleted', false)
    .order('created_at', { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await request.json();
  const {
    type = 'analyze',
    url,
    targetQuery,
    reportText,
    geoScore,
    signals,
    pageContent,
    provider,
    model,
    seoMetrics,
    consentTraining,
    // Performance metrics
    durationMs,
    timeToFirstTokenMs,
    // Rewrite-specific
    scoreBeforeRewrite,
    scoreAfterRewrite,
    signalsFixed,
    // Competitor-specific
    competitorUrl,
    competitorScore,
  } = body;

  const supabase = getSupabaseServerClient();

  const record = {
    user_id: session.user.id,
    type,
    url,
    target_query: targetQuery,
    report_text: reportText,
    geo_score: geoScore,
    signals: signals ?? [],
    page_content: pageContent ?? null,
    provider,
    model,
    duration_ms: durationMs ?? null,
    time_to_first_token_ms: timeToFirstTokenMs ?? null,
    score_before: scoreBeforeRewrite ?? null,
    score_after: scoreAfterRewrite ?? null,
    signals_fixed: signalsFixed ?? null,
    competitor_url: competitorUrl ?? null,
    competitor_score: competitorScore ?? null,
    seo_domain_authority: seoMetrics?.domainAuthority ? parseInt(seoMetrics.domainAuthority) : null,
    seo_page_authority: seoMetrics?.pageAuthority ? parseInt(seoMetrics.pageAuthority) : null,
    seo_google_position: seoMetrics?.googlePosition ? parseInt(seoMetrics.googlePosition) : null,
    seo_ranking_keywords: seoMetrics?.rankingKeywords ? parseInt(seoMetrics.rankingKeywords) : null,
    seo_top3_keywords: seoMetrics?.top3Keywords ? parseInt(seoMetrics.top3Keywords) : null,
    seo_monthly_traffic: seoMetrics?.monthlyTraffic ? parseInt(seoMetrics.monthlyTraffic) : null,
    seo_linking_domains: seoMetrics?.backlinks ? parseInt(seoMetrics.backlinks) : null,
    seo_spam_score: seoMetrics?.spamScore ? parseFloat(seoMetrics.spamScore) : null,
    consent_training: consentTraining ?? false,
    updated_at: new Date().toISOString(),
  };

  // Always INSERT — keeps full history of every run across all tab types.
  // Analyze runs show score progression; Rewrite shows before/after; Competitor shows gap over time.
  const { data, error } = await supabase.from('reports').insert(record).select().single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

export async function DELETE(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await request.json();
  const supabase = getSupabaseServerClient();
  const { error } = await supabase
    .from('reports')
    .update({ deleted: true })
    .eq('id', id)
    .eq('user_id', session.user.id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}
