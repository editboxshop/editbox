import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

export async function PUT(request: Request) {
  try {
    const { id, title, category } = await request.json();

    if (!id || !title || !category) {
      console.error('API Route: Missing id, title, or category');
      return NextResponse.json({ error: 'Missing id, title, or category' }, { status: 400 });
    }

    const { error: dbError } = await supabase
      .from('posters')
      .update({ title, category })
      .eq('id', id);

    if (dbError) {
      console.error('API Route: Database update error:', dbError);
      return NextResponse.json({ error: 'Failed to update poster: ' + dbError.message }, { status: 400 });
    }

    console.log('API Route: Poster updated successfully:', { id, title, category });
    return NextResponse.json({ message: 'Poster updated successfully' }, { status: 200 });
  } catch (error: any) {
    console.error('API Route: General error:', error);
    return NextResponse.json({ error: 'Update failed: ' + error.message }, { status: 500 });
  }
}