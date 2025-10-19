'use client';

import { useState, useEffect } from 'react';
import Image from 'next/image';
import { supabase } from '@/lib/supabase';
import { LucideSave, LucideDownload, LucideLoader2, LucideEdit, LucideTrash } from 'lucide-react';
import './posters.css';

interface Poster {
  id: number;
  title: string;
  category: 'Festival' | 'Birthday' | 'Marriage';
  download_url: string;
  psd_url?: string;
  font_family?: string;
  is_editable: boolean;
  created_at: string;
}

export default function AdminPosters() {
  const [posters, setPosters] = useState<Poster[]>([]);
  const [loading, setLoading] = useState(true);
  const [formData, setFormData] = useState({
    category: 'Festival' as 'Festival' | 'Birthday' | 'Marriage',
    title: '',
    file: null as File | null,
    thumbnail: null as File | null,
    isEditable: false,
    fontFamily: 'Roboto',
  });
  const [saving, setSaving] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [editingPoster, setEditingPoster] = useState<Poster | null>(null);
  const [editFormData, setEditFormData] = useState({
    title: '',
    category: 'Festival' as 'Festival' | 'Birthday' | 'Marriage',
    fontFamily: 'Roboto',
    isEditable: false,
  });

  useEffect(() => {
    const fetchPosters = async () => {
      const { data, error } = await supabase
        .from('posters')
        .select('id, title, category, download_url, psd_url, font_family, is_editable, created_at')
        .order('created_at', { ascending: false });

      if (error) {
        setError('Failed to fetch posters: ' + error.message);
      } else {
        setPosters(data || []);
      }
      setLoading(false);
    };

    fetchPosters();

    const subscription = supabase
      .channel('posters-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'posters' }, (payload) => {
        if (payload.eventType === 'INSERT') {
          setPosters((prev) => [payload.new as Poster, ...prev]);
        } else if (payload.eventType === 'DELETE') {
          setPosters((prev) => prev.filter((p) => p.id !== payload.old.id));
        } else if (payload.eventType === 'UPDATE') {
          setPosters((prev) =>
            prev.map((p) => (p.id === payload.new.id ? (payload.new as Poster) : p))
          );
        }
      })
      .subscribe();

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  const handleInputChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>
  ) => {
    const { name, value, files, type, checked } = e.target as any;
    if (name === 'file' || name === 'thumbnail') {
      setFormData((prev) => ({ ...prev, [name]: files ? files[0] : null }));
    } else if (type === 'checkbox') {
      setFormData((prev) => ({ ...prev, [name]: checked }));
    } else {
      setFormData((prev) => ({ ...prev, [name]: value }));
    }
  };

  const handleEditInputChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>
  ) => {
    const { name, value, type, checked } = e.target as any;
    setEditFormData((prev) => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value,
    }));
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    setUploadProgress(0);

    if (!formData.title || !formData.file) {
      setError('Title and file are required.');
      setSaving(false);
      return;
    }

    if (formData.isEditable && formData.file.name.split('.').pop()?.toLowerCase() === 'psd' && !formData.thumbnail) {
      setError('Thumbnail image (PNG/JPEG) is required for editable PSDs.');
      setSaving(false);
      return;
    }

    const MAX_FILE_SIZE = 50 * 1024 * 1024;
    if (formData.file.size > MAX_FILE_SIZE || (formData.thumbnail && formData.thumbnail.size > MAX_FILE_SIZE)) {
      setError(`File size exceeds maximum limit of ${MAX_FILE_SIZE / (1024 * 1024)}MB`);
      setSaving(false);
      return;
    }

    const formDataToSend = new FormData();
    formDataToSend.append('file', formData.file);
    if (formData.thumbnail) formDataToSend.append('thumbnail', formData.thumbnail);
    formDataToSend.append('title', formData.title);
    formDataToSend.append('category', formData.category);
    formDataToSend.append('isEditable', formData.isEditable.toString());
    formDataToSend.append('fontFamily', formData.fontFamily);

    try {
      const interval = setInterval(() => {
        setUploadProgress((prev) => {
          if (prev >= 90) {
            clearInterval(interval);
            return prev;
          }
          return prev + 10;
        });
      }, 500);

      const response = await fetch('/api/upload', {
        method: 'POST',
        body: formDataToSend,
      });

      const result = await response.json();
      if (!response.ok) {
        throw new Error(result.error || 'Failed to upload file');
      }

      clearInterval(interval);
      setUploadProgress(100);
      setFormData({ category: 'Festival', title: '', file: null, thumbnail: null, isEditable: false, fontFamily: 'Roboto' });
      (document.getElementById('file-input') as HTMLInputElement).value = '';
      if (document.getElementById('thumbnail-input')) {
        (document.getElementById('thumbnail-input') as HTMLInputElement).value = '';
      }
    } catch (error: any) {
      setError(error.message);
    } finally {
      setSaving(false);
    }
  };

  const handleDownload = async (url: string, title: string) => {
    try {
      const response = await fetch(url, { mode: 'cors' });
      if (!response.ok) throw new Error('Failed to fetch file');
      const blob = await response.blob();
      const blobUrl = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = blobUrl;
      link.download = title || 'poster';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(blobUrl);
    } catch (error: any) {
      setError('Failed to download file: ' + error.message);
    }
  };

  const handleDelete = async (id: number, filename: string) => {
    if (!confirm('Are you sure you want to delete this poster?')) return;

    try {
      const { error: deleteError } = await supabase.from('posters').delete().eq('id', id);
      if (deleteError) {
        setError('Failed to delete poster: ' + deleteError.message);
        return;
      }

      const path = filename.includes('psd/') ? filename : `thumbnails/${filename}`;
      const { error: storageError } = await supabase.storage.from('posters').remove([path]);
      if (storageError) {
        setError('Failed to delete file from storage: ' + storageError.message);
      }
    } catch (error: any) {
      setError('Failed to delete poster: ' + error.message);
    }
  };

  const handleEdit = (poster: Poster) => {
    setEditingPoster(poster);
    setEditFormData({
      title: poster.title,
      category: poster.category,
      fontFamily: poster.font_family || 'Roboto',
      isEditable: poster.is_editable,
    });
  };

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingPoster) return;

    try {
      const { error } = await supabase
        .from('posters')
        .update({
          title: editFormData.title,
          category: editFormData.category,
          font_family: editFormData.fontFamily,
          is_editable: editFormData.isEditable,
        })
        .eq('id', editingPoster.id);

      if (error) {
        setError('Failed to update poster: ' + error.message);
      } else {
        setEditingPoster(null);
        setEditFormData({ title: '', category: 'Festival', fontFamily: 'Roboto', isEditable: false });
      }
    } catch (error: any) {
      setError('Failed to update poster: ' + error.message);
    }
  };

  const closeEditModal = () => {
    setEditingPoster(null);
    setEditFormData({ title: '', category: 'Festival', fontFamily: 'Roboto', isEditable: false });
  };

  if (loading) {
    return (
      <div className="loading">
        <LucideLoader2 className="loading-spinner h-8 w-8" style={{ color: '#FFD700' }} />
      </div>
    );
  }

  return (
    <div className="container">
      <div className="content">
        <div className="form-section">
          <h2>✨ Admin Poster Dashboard</h2>
          {error && <p className="error">{error}</p>}
          <form onSubmit={handleSave} className="form">
            <div className="form-group">
              <label>Category</label>
              <select name="category" value={formData.category} onChange={handleInputChange}>
                <option value="Festival">Festival</option>
                <option value="Birthday">Birthday</option>
                <option value="Marriage">Marriage</option>
              </select>
            </div>
            <div className="form-group">
              <label>Poster Title</label>
              <input
                type="text"
                name="title"
                value={formData.title}
                onChange={handleInputChange}
                placeholder="e.g., Happy Diwali 2025"
              />
            </div>
            <div className="form-group">
              <label>Upload File (Image or PSD, max 50MB)</label>
              <input
                id="file-input"
                type="file"
                name="file"
                accept="image/*,.psd"
                onChange={handleInputChange}
              />
            </div>
            <div className="form-group">
              <label>Thumbnail Image (PNG/JPEG, required for PSDs, max 50MB)</label>
              <input
                id="thumbnail-input"
                type="file"
                name="thumbnail"
                accept="image/png,image/jpeg"
                onChange={handleInputChange}
              />
            </div>
            <div className="form-group">
              <label>
                <input
                  type="checkbox"
                  name="isEditable"
                  checked={formData.isEditable}
                  onChange={handleInputChange}
                />
                Editable by Users
              </label>
            </div>
            <div className="form-group">
              <label>Font Family (for text overlays)</label>
              <select name="fontFamily" value={formData.fontFamily} onChange={handleInputChange}>
                <option value="Roboto">Roboto</option>
                <option value="Montserrat">Montserrat</option>
                <option value="Open Sans">Open Sans</option>
                <option value="Lato">Lato</option>
              </select>
            </div>
            <button type="submit" disabled={saving} className="submit-button">
              <LucideSave className="mr-2 h-4 w-4" />
              {saving ? 'Saving...' : 'Save Poster'}
            </button>
            {saving && (
              <div className="progress-container">
                <div className="progress-header">
                  <span className="progress-label">Uploading Poster...</span>
                  <span className="progress-percentage">{uploadProgress}%</span>
                </div>
                <div className="progress-bar-wrapper">
                  <div
                    className="progress-bar-track pulse"
                    style={{ width: `${uploadProgress}%` }}
                  >
                    <div className="progress-bar-fill"></div>
                  </div>
                </div>
                <div className="progress-steps">
                  {[0, 25, 50, 75, 100].map((step) => (
                    <div
                      key={step}
                      className={`progress-step ${
                        uploadProgress >= step ? 'active' : ''
                      } ${
                        uploadProgress >= step && step === 100 ? 'complete' : ''
                      }`}
                    />
                  ))}
                </div>
                <div className="progress-details">
                  <span className="progress-speed">
                    ⚡ {uploadProgress < 50 ? 'Processing...' : 'Finalizing...'}
                  </span>
                  <span className="progress-time">
                    {uploadProgress < 100 ? 'Almost there...' : 'Complete!'}
                  </span>
                </div>
              </div>
            )}
          </form>
        </div>

        <div className="posters-section">
          <h2>📸 Uploaded Posters</h2>
          <div className="posters-grid">
            {posters.length === 0 ? (
              <p className="no-posters">No posters uploaded yet.</p>
            ) : (
              posters.map((poster) => (
                <div key={poster.id} className="poster-card">
                  <div className="poster-image-container">
                    <Image
                      src={poster.download_url || poster.psd_url || '/placeholder.png'}
                      alt={poster.title}
                      fill
                      sizes="(max-width: 768px) 100vw, 33vw"
                      className="poster-image"
                      loading="lazy"
                    />
                    {poster.is_editable && (
                      <span className="editable-badge">Editable</span>
                    )}
                  </div>
                  <div className="poster-content">
                    <h3 className="poster-title">{poster.title}</h3>
                    <p className="poster-category">{poster.category}</p>
                    <p className="poster-font">{poster.font_family || 'N/A'}</p>
                    <div className="poster-actions">
                      <button
                        onClick={() => handleDownload(poster.download_url || poster.psd_url || '', poster.title)}
                        className="download-button"
                      >
                        <LucideDownload className="mr-2 h-4 w-4" />
                        Download
                      </button>
                      <button
                        onClick={() => handleEdit(poster)}
                        className="edit-button"
                      >
                        <LucideEdit className="mr-2 h-4 w-4" />
                        Edit
                      </button>
                      <button
                        onClick={() => handleDelete(poster.id, (poster.download_url || poster.psd_url || '').split('/').pop()!)}
                        className="delete-button"
                      >
                        <LucideTrash className="mr-2 h-4 w-4" />
                        Delete
                      </button>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {editingPoster && (
        <div className="modal">
          <div className="modal-content">
            <h2>Edit Poster</h2>
            <form onSubmit={handleUpdate} className="form">
              <div className="form-group">
                <label>Poster Title</label>
                <input
                  type="text"
                  name="title"
                  value={editFormData.title}
                  onChange={handleEditInputChange}
                  placeholder="e.g., Happy Diwali 2025"
                />
              </div>
              <div className="form-group">
                <label>Category</label>
                <select name="category" value={editFormData.category} onChange={handleEditInputChange}>
                  <option value="Festival">Festival</option>
                  <option value="Birthday">Birthday</option>
                  <option value="Marriage">Marriage</option>
                </select>
              </div>
              <div className="form-group">
                <label>Font Family</label>
                <select name="fontFamily" value={editFormData.fontFamily} onChange={handleEditInputChange}>
                  <option value="Roboto">Roboto</option>
                  <option value="Montserrat">Montserrat</option>
                  <option value="Open Sans">Open Sans</option>
                  <option value="Lato">Lato</option>
                </select>
              </div>
              <div className="form-group">
                <label>
                  <input
                    type="checkbox"
                    name="isEditable"
                    checked={editFormData.isEditable}
                    onChange={handleEditInputChange}
                  />
                  Editable by Users
                </label>
              </div>
              <div className="modal-actions">
                <button type="submit" className="submit-button">
                  <LucideSave className="mr-2 h-4 w-4" />
                  Update
                </button>
                <button type="button" onClick={closeEditModal} className="cancel-button">
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}