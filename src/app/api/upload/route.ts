import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File;
    const thumbnail = formData.get('thumbnail') as File | null;
    const title = formData.get('title') as string;
    const category = formData.get('category') as string;
    const isEditable = formData.get('isEditable') === 'true';
    const fontFamily = formData.get('fontFamily') as string;

    if (!file || !title || !category) {
      return NextResponse.json({ error: 'Missing file, title, or category' }, { status: 400 });
    }

    // Validate file size (50MB)
    const MAX_FILE_SIZE = 50 * 1024 * 1024;
    if (file.size > MAX_FILE_SIZE || (thumbnail && thumbnail.size > MAX_FILE_SIZE)) {
      return NextResponse.json(
        { error: `File size exceeds maximum limit of ${MAX_FILE_SIZE / (1024 * 1024)}MB` },
        { status: 400 }
      );
    }

    const fileExt = file.name.split('.').pop()?.toLowerCase();
    const isPsd = fileExt === 'psd';
    const fileName = `${Date.now()}-${title.replace(/\s+/g, '-')}.${fileExt}`;
    const uploadPath = isPsd ? `psd/${fileName}` : `thumbnails/${fileName}`;

    // Upload main file
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    const { error: uploadError } = await supabase.storage
      .from('posters')
      .upload(uploadPath, buffer, { contentType: file.type, upsert: true });

    if (uploadError) {
      console.error('Storage error:', uploadError);
      return NextResponse.json({ error: 'Upload failed: ' + uploadError.message }, { status: 400 });
    }

    const { data: { publicUrl } } = supabase.storage.from('posters').getPublicUrl(uploadPath);

    // Upload thumbnail if provided
    let thumbnailUrl = '';
    if (thumbnail) {
      const thumbnailName = `${Date.now()}-${title.replace(/\s+/g, '-')}-thumb.png`;
      const thumbnailPath = `thumbnails/${thumbnailName}`;
      const thumbnailBuffer = Buffer.from(await thumbnail.arrayBuffer());
      const { error: thumbnailError } = await supabase.storage
        .from('posters')
        .upload(thumbnailPath, thumbnailBuffer, { contentType: thumbnail.type, upsert: true });

      if (thumbnailError) {
        console.error('Thumbnail upload error:', thumbnailError);
        return NextResponse.json({ error: 'Thumbnail upload failed: ' + thumbnailError.message }, { status: 400 });
      }
      thumbnailUrl = supabase.storage.from('posters').getPublicUrl(thumbnailPath).data.publicUrl;
    }

    // Insert into database
    const { error: dbError } = await supabase.from('posters').insert([
      {
        title,
        category,
        download_url: isPsd ? thumbnailUrl : publicUrl,
        psd_url: isPsd ? publicUrl : null,
        font_family: fontFamily,
        is_editable: isEditable,
        created_at: new Date().toISOString(),
      },
    ]);

    if (dbError) {
      console.error('Database error:', dbError);
      return NextResponse.json({ error: 'Database insert failed: ' + dbError.message }, { status: 400 });
    }

    return NextResponse.json(
      { downloadLink: isPsd ? thumbnailUrl : publicUrl, title, category, isEditable, fontFamily },
      { status: 200 }
    );
  } catch (error: any) {
    console.error('Upload error:', error);
    return NextResponse.json({ error: 'Upload failed: ' + error.message }, { status: 500 });
  }
}