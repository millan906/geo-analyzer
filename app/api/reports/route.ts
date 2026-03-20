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
  } = body;

  const supabase = getSupabaseServerClient();
  const { data, error } = await supabase
    .from('reports')
    .upsert(
      {
        user_id: session.user.id,
        url,
        target_query: targetQuery,
        report_text: reportText,
        geo_score: geoScore,
        signals: signals ?? [],
        page_content: pageContent ?? null,
        provider,
        model,
        // SEO metrics for training correlation
        seo_domain_authority: seoMetrics?.domainAuthority
          ? parseInt(seoMetrics.domainAuthority)
          : null,
        seo_page_authority: seoMetrics?.pageAuthority ? parseInt(seoMetrics.pageAuthority) : null,
        seo_google_position: seoMetrics?.googlePosition
          ? parseInt(seoMetrics.googlePosition)
          : null,
        seo_ranking_keywords: seoMetrics?.rankingKeywords
          ? parseInt(seoMetrics.rankingKeywords)
          : null,
        seo_top3_keywords: seoMetrics?.top3Keywords ? parseInt(seoMetrics.top3Keywords) : null,
        seo_monthly_traffic: seoMetrics?.monthlyTraffic
          ? parseInt(seoMetrics.monthlyTraffic)
          : null,
        seo_linking_domains: seoMetrics?.backlinks ? parseInt(seoMetrics.backlinks) : null,
        seo_spam_score: seoMetrics?.spamScore ? parseFloat(seoMetrics.spamScore) : null,
        consent_training: consentTraining ?? false,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'user_id,url', ignoreDuplicates: false }
    )
    .select()
    .single();

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
