import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

export async function DELETE(request: Request) {
  try {
    const { id, filename } = await request.json();

    if (!id || !filename) {
      console.error('API Route: Missing id or filename');
      return NextResponse.json({ error: 'Missing id or filename' }, { status: 400 });
    }

    // Delete from storage
    const { error: storageError } = await supabase.storage
      .from('posters')
      .remove([filename]);

    if (storageError) {
      console.error('API Route: Storage delete error:', storageError);
      return NextResponse.json({ error: 'Failed to delete file: ' + storageError.message }, { status: 400 });
    }

    // Delete from table
    const { error: dbError } = await supabase
      .from('posters')
      .delete()
      .eq('id', id);

    if (dbError) {
      console.error('API Route: Database delete error:', dbError);
      return NextResponse.json({ error: 'Failed to delete poster: ' + dbError.message }, { status: 400 });
    }

    console.log('API Route: Poster deleted successfully:', { id, filename });
    return NextResponse.json({ message: 'Poster deleted successfully' }, { status: 200 });
  } catch (error: any) {
    console.error('API Route: General error:', error);
    return NextResponse.json({ error: 'Delete failed: ' + error.message }, { status: 500 });
  }
}