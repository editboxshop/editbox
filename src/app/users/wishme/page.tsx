'use client';

import { useState, useEffect, useRef } from 'react';
import Image from 'next/image';
import { supabase } from '@/lib/supabase';
import { motion, AnimatePresence } from 'framer-motion';
import { Search, User, Download, Sun, Moon, Sparkles, ChevronRight, ChevronLeft, LucideEdit, ChevronUp, ChevronDown } from 'lucide-react';
import html2canvas from 'html2canvas';
import './wishme.css';

interface Poster {
  id: number;
  title: string;
  category: 'Festival' | 'Birthday' | 'Marriage';
  download_url: string;
  psd_url?: string;
  font_family?: string;
  is_editable: boolean;
  created_at: string;
  download_count: number;
}

function CategoryScroll({
  selectedCategory,
  setSelectedCategory,
}: {
  selectedCategory: string;
  setSelectedCategory: (category: string) => void;
}) {
  const [isDesktop, setIsDesktop] = useState(true);
  const [categorySetIndex, setCategorySetIndex] = useState(0);

  useEffect(() => {
    const handleResize = () => {
      setIsDesktop(window.innerWidth >= 768);
    };

    handleResize();
    let timeoutId: NodeJS.Timeout;
    const debouncedResize = () => {
      clearTimeout(timeoutId);
      timeoutId = setTimeout(handleResize, 100);
    };

    window.addEventListener('resize', debouncedResize);
    return () => {
      window.removeEventListener('resize', debouncedResize);
      clearTimeout(timeoutId);
    };
  }, []);

  const categories = ['All', 'Festival', 'Birthday', 'Marriage'];
  const categoriesPerSet = 3;
  const totalSets = Math.ceil(categories.slice(1).length / categoriesPerSet);
  const currentCategories = isDesktop
    ? categories
    : categories.slice(1).slice(categorySetIndex * categoriesPerSet, (categorySetIndex + 1) * categoriesPerSet);

  const handleNextSet = () => {
    setCategorySetIndex((prev) => (prev + 1) % totalSets);
  };

  const handlePrevSet = () => {
    setCategorySetIndex((prev) => (prev - 1 + totalSets) % totalSets);
  };

  return (
    <div className="category-scroll">
      {!isDesktop && (
        <motion.button
          className="prev-set-btn"
          onClick={handlePrevSet}
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          aria-label="Show previous category set"
          suppressHydrationWarning
        >
          <ChevronLeft size={16} aria-hidden="true" />
        </motion.button>
      )}
      <AnimatePresence mode="wait">
        <motion.div
          key={isDesktop ? 'all' : categorySetIndex}
          className="category-set"
          initial={{ opacity: 0, x: isDesktop ? 0 : 50 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: isDesktop ? 0 : -50 }}
          transition={{ duration: 0.3 }}
        >
          {currentCategories.map(category => (
            <motion.button
              key={category}
              className={`category-btn ${selectedCategory === category ? 'active' : ''}`}
              onClick={() => setSelectedCategory(category)}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              aria-label={`Filter by ${category}`}
              suppressHydrationWarning
            >
              {category}
            </motion.button>
          ))}
        </motion.div>
      </AnimatePresence>
      {!isDesktop && (
        <motion.button
          className="next-set-btn"
          onClick={handleNextSet}
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          aria-label="Show next category set"
          suppressHydrationWarning
        >
          <ChevronRight size={16} aria-hidden="true" />
        </motion.button>
      )}
    </div>
  );
}

export default function UserDashboard() {
  const [posters, setPosters] = useState<Poster[]>([]);
  const [filteredPosters, setFilteredPosters] = useState<Poster[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('All');
  const [sortBy, setSortBy] = useState<'latest' | 'popular'>('latest');
  const [isDarkMode, setIsDarkMode] = useState(false);
  const [countdowns, setCountdowns] = useState<{ [key: number]: number }>({});
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [editingPoster, setEditingPoster] = useState<Poster | null>(null);
  const [editFormData, setEditFormData] = useState({
    name: '',
    image: null as File | null,
    textColor: '#FFFFFF',
    imagePosition: { x: 50, y: 180 },
    textPosition: { x: 200, y: 240 },
    fontSize: 24,
    fontFamily: 'Arial',
    fontStyle: 'normal',
    fontWeight: 'normal',
    textRotation: 0,
    imageRotation: 0,
    imageSize: { width: 100, height: 100 },
  });
  const [zoomLevel, setZoomLevel] = useState(1);
  const canvasRef = useRef<HTMLDivElement>(null);
  const textRef = useRef<HTMLDivElement>(null);
  const imageRef = useRef<HTMLDivElement>(null);
  const previewRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const fetchPosters = async () => {
      try {
        const { data, error } = await supabase
          .from('posters')
          .select('id, title, category, download_url, psd_url, font_family, is_editable, created_at, download_count')
          .order('created_at', { ascending: false });

        if (error) {
          console.error('Error fetching posters:', error);
          setErrorMessage('Failed to load posters. Please try again later.');
          return;
        }

        setPosters(data || []);
        setFilteredPosters(data || []);
      } catch (err) {
        console.error('Unexpected error fetching posters:', err);
        setErrorMessage('An unexpected error occurred. Please try again.');
      } finally {
        setLoading(false);
      }
    };

    fetchPosters();
  }, []);

  useEffect(() => {
    let result = [...posters];

    if (searchQuery) {
      result = result.filter(poster =>
        poster.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        poster.category.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }

    if (selectedCategory !== 'All') {
      result = result.filter(poster => poster.category === selectedCategory);
    }

    if (sortBy === 'popular') {
      result.sort((a, b) => (b.download_count || 0) - (a.download_count || 0));
    } else {
      result.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    }

    setFilteredPosters(result);
  }, [searchQuery, selectedCategory, sortBy, posters]);

  const handleDownload = async (id: number, url: string, title: string) => {
    try {
      setCountdowns(prev => ({ ...prev, [id]: 5 }));
      const interval = setInterval(() => {
        setCountdowns(prev => {
          const newCount = (prev[id] || 5) - 1;
          if (newCount <= 0) {
            clearInterval(interval);
            return { ...prev, [id]: 0 };
          }
          return { ...prev, [id]: newCount };
        });
      }, 1000);

      await new Promise(resolve => setTimeout(resolve, 5000));

      const { data: posterData, error: fetchError } = await supabase
        .from('posters')
        .select('download_count')
        .eq('id', id)
        .single();

      if (fetchError) {
        console.error('Error fetching download count:', fetchError);
        setErrorMessage('Failed to update download count.');
        return;
      }

      const newCount = (posterData.download_count || 0) + 1;
      const { error: updateError } = await supabase
        .from('posters')
        .update({ download_count: newCount })
        .eq('id', id);

      if (updateError) {
        console.error('Error updating download count:', updateError);
        setErrorMessage('Failed to update download count.');
        return;
      }

      setPosters(prev =>
        prev.map(poster =>
          poster.id === id
            ? { ...poster, download_count: newCount }
            : poster
        )
      );
      setFilteredPosters(prev =>
        prev.map(poster =>
          poster.id === id
            ? { ...poster, download_count: newCount }
            : poster
        )
      );

      const response = await fetch(url, { mode: 'cors' });
      if (!response.ok) throw new Error('Failed to fetch image');
      const blob = await response.blob();
      const blobUrl = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = blobUrl;
      link.download = title || 'poster';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(blobUrl);
    } catch (error) {
      console.error('Download error:', error);
      setErrorMessage('Failed to download the poster. Please try again.');
    } finally {
      setCountdowns(prev => {
        const newCountdowns = { ...prev };
        delete newCountdowns[id];
        return newCountdowns;
      });
    }
  };

  const handleEditInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value, files } = e.target as any;
    if (name === 'image') {
      const file = files && files[0];
      if (file && file.size > 5 * 1024 * 1024) {
        setErrorMessage('Uploaded image exceeds 5MB limit.');
        return;
      }
      setEditFormData((prev) => ({
        ...prev,
        image: file?.type === 'image/png' ? file : null,
      }));
    } else {
      setEditFormData((prev) => ({ ...prev, [name]: value }));
    }
  };

  const handleTextDrag = (_e: any, info: { delta: { x: number; y: number } }) => {
    setEditFormData((prev) => {
      const scaledWidth = (textRef.current?.offsetWidth || 0) * zoomLevel;
      const scaledHeight = (textRef.current?.offsetHeight || 0) * zoomLevel;
      const newX = Math.max(0, Math.min(400 - scaledWidth, prev.textPosition.x + info.delta.x / zoomLevel));
      const newY = Math.max(0, Math.min(280 - scaledHeight, prev.textPosition.y + info.delta.y / zoomLevel));
      return {
        ...prev,
        textPosition: { x: newX, y: newY },
      };
    });
  };

  const handleImageDrag = (_e: any, info: { delta: { x: number; y: number } }) => {
    setEditFormData((prev) => {
      const scaledWidth = prev.imageSize.width * zoomLevel;
      const scaledHeight = prev.imageSize.height * zoomLevel;
      const newX = Math.max(0, Math.min(400 - scaledWidth, prev.imagePosition.x + info.delta.x / zoomLevel));
      const newY = Math.max(0, Math.min(280 - scaledHeight, prev.imagePosition.y + info.delta.y / zoomLevel));
      return {
        ...prev,
        imagePosition: { x: newX, y: newY },
      };
    });
  };

  const handleFontSizeChange = (delta: number) => {
    setEditFormData((prev) => ({
      ...prev,
      fontSize: Math.max(10, prev.fontSize + delta),
    }));
  };

  const handleImageSizeChange = (deltaWidth: number, deltaHeight: number) => {
    setEditFormData((prev) => ({
      ...prev,
      imageSize: {
        width: Math.max(50, prev.imageSize.width + deltaWidth),
        height: Math.max(50, prev.imageSize.height + deltaHeight),
      },
    }));
  };

  const handleRotationChange = (type: 'text' | 'image', delta: number) => {
    setEditFormData((prev) => ({
      ...prev,
      [type === 'text' ? 'textRotation' : 'imageRotation']: (prev[type === 'text' ? 'textRotation' : 'imageRotation'] + delta) % 360,
    }));
  };

  const handleResizeStart = (e: React.MouseEvent | React.TouchEvent, handle: 'bottom-right' | 'top-left') => {
    e.preventDefault();
    const startX = 'touches' in e ? e.touches[0].clientX : e.clientX;
    const startY = 'touches' in e ? e.touches[0].clientY : e.clientY;
    const startWidth = editFormData.imageSize.width;
    const startHeight = editFormData.imageSize.height;

    const handleResizeMove = (moveEvent: MouseEvent | TouchEvent) => {
      const clientX = 'touches' in moveEvent ? moveEvent.touches[0].clientX : moveEvent.clientX;
      const clientY = 'touches' in moveEvent ? moveEvent.touches[0].clientY : moveEvent.clientY;
      const deltaX = (clientX - startX) / zoomLevel;
      const deltaY = (clientY - startY) / zoomLevel;

      setEditFormData((prev) => {
        let newWidth = startWidth;
        let newHeight = startHeight;

        if (handle === 'bottom-right') {
          newWidth = Math.max(50, startWidth + deltaX);
          newHeight = Math.max(50, startHeight + deltaY);
        } else if (handle === 'top-left') {
          newWidth = Math.max(50, startWidth - deltaX);
          newHeight = Math.max(50, startHeight - deltaY);
        }

        // Maintain aspect ratio
        const aspectRatio = startWidth / startHeight;
        newHeight = newWidth / aspectRatio;

        // Ensure image stays within preview bounds
        const scaledWidth = newWidth * zoomLevel;
        const scaledHeight = newHeight * zoomLevel;
        const maxX = 400 - scaledWidth;
        const maxY = 280 - scaledHeight;
        const newX = Math.max(0, Math.min(maxX, prev.imagePosition.x));
        const newY = Math.max(0, Math.min(maxY, prev.imagePosition.y));

        return {
          ...prev,
          imageSize: { width: newWidth, height: newHeight },
          imagePosition: { x: newX, y: newY },
        };
      });
    };

    const handleResizeEnd = () => {
      window.removeEventListener('mousemove', handleResizeMove);
      window.removeEventListener('touchmove', handleResizeMove);
      window.removeEventListener('mouseup', handleResizeEnd);
      window.removeEventListener('touchend', handleResizeEnd);
    };

    window.addEventListener('mousemove', handleResizeMove);
    window.addEventListener('touchmove', handleResizeMove, { passive: false });
    window.addEventListener('mouseup', handleResizeEnd);
    window.addEventListener('touchend', handleResizeEnd);
  };

  const handleRotateStart = (e: React.MouseEvent | React.TouchEvent) => {
    e.preventDefault();
    const rect = imageRef.current?.getBoundingClientRect();
    if (!rect) return;

    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;

    const handleRotateMove = (moveEvent: MouseEvent | TouchEvent) => {
      const clientX = 'touches' in moveEvent ? moveEvent.touches[0].clientX : moveEvent.clientX;
      const clientY = 'touches' in moveEvent ? moveEvent.touches[0].clientY : moveEvent.clientY;

      const angle = Math.atan2(clientY - centerY, clientX - centerX) * (180 / Math.PI);
      setEditFormData((prev) => ({
        ...prev,
        imageRotation: angle,
      }));
    };

    const handleRotateEnd = () => {
      window.removeEventListener('mousemove', handleRotateMove);
      window.removeEventListener('touchmove', handleRotateMove);
      window.removeEventListener('mouseup', handleRotateEnd);
      window.removeEventListener('touchend', handleRotateEnd);
    };

    window.addEventListener('mousemove', handleRotateMove);
    window.addEventListener('touchmove', handleRotateMove, { passive: false });
    window.addEventListener('mouseup', handleRotateEnd);
    window.addEventListener('touchend', handleRotateEnd);
  };

  const handleZoom = (delta: number) => {
    setZoomLevel(prev => Math.min(Math.max(0.5, prev + delta), 3));
  };

  const handleScrollPreview = (direction: 'up' | 'down') => {
    if (previewRef.current) {
      const scrollAmount = 50;
      const currentScroll = previewRef.current.scrollTop;
      const newScroll = direction === 'up' ? currentScroll - scrollAmount : currentScroll + scrollAmount;
      previewRef.current.scrollTo({ top: newScroll, behavior: 'smooth' });
    }
  };

  const handleEditSave = async () => {
    if (!canvasRef.current || typeof window === 'undefined') {
      console.error('Canvas ref is null or not in browser environment');
      setErrorMessage('Cannot save: Canvas not found');
      return;
    }

    try {
      console.log('Saving customized poster');
      const canvas = await html2canvas(canvasRef.current, {
        useCORS: true,
        scale: 2, // Increase resolution for better quality
        backgroundColor: null,
      });
      const link = document.createElement('a');
      link.href = canvas.toDataURL('image/png', 1.0);
      link.download = `${editingPoster!.title}-customized.png`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      const { error } = await supabase
        .from('posters')
        .update({ download_count: (editingPoster!.download_count || 0) + 1 })
        .eq('id', editingPoster!.id);

      if (error) {
        console.error('Failed to update download count:', error);
        setErrorMessage('Failed to update download count.');
      } else {
        setPosters(prev =>
          prev.map(poster =>
            poster.id === editingPoster!.id
              ? { ...poster, download_count: (poster.download_count || 0) + 1 }
              : poster
          )
        );
        setFilteredPosters(prev =>
          prev.map(poster =>
            poster.id === editingPoster!.id
              ? { ...poster, download_count: (poster.download_count || 0) + 1 }
              : poster
          )
        );
      }

      setEditingPoster(null);
      setEditFormData({
        name: '',
        image: null,
        textColor: '#FFFFFF',
        imagePosition: { x: 50, y: 180 },
        textPosition: { x: 200, y: 240 },
        fontSize: 24,
        fontFamily: 'Arial',
        fontStyle: 'normal',
        fontWeight: 'normal',
        textRotation: 0,
        imageRotation: 0,
        imageSize: { width: 100, height: 100 },
      });
      setZoomLevel(1);
    } catch (error) {
      console.error('Error saving customized poster:', error);
      setErrorMessage('Failed to save customized poster: ' + (error as Error).message);
    }
  };

  const closeEditModal = () => {
    console.log('Closing edit modal');
    setEditingPoster(null);
    setEditFormData({
      name: '',
      image: null,
      textColor: '#FFFFFF',
      imagePosition: { x: 50, y: 180 },
      textPosition: { x: 200, y: 240 },
      fontSize: 24,
      fontFamily: 'Arial',
      fontStyle: 'normal',
      fontWeight: 'normal',
      textRotation: 0,
      imageRotation: 0,
      imageSize: { width: 100, height: 100 },
    });
    setZoomLevel(1);
  };

  const toggleDarkMode = () => {
    setIsDarkMode(!isDarkMode);
    document.documentElement.classList.toggle('dark');
  };

  return (
    <div className={`dashboard ${isDarkMode ? 'dark' : ''}`} role="main">
      <header className="header" role="banner">
        <div className="header-top">
          <div className="logo-section">
            <motion.h1
              className="logo"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.5 }}
              aria-label="WishMe Logo"
            >
              WishMe <Sparkles className="logo-icon" aria-hidden="true" />
            </motion.h1>
          </div>
          <div className="header-actions">
            <button
              className="profile-btn"
              aria-label="User Profile"
              suppressHydrationWarning
            >
              <User size={20} />
            </button>
            <button
              className="mode-toggle"
              onClick={toggleDarkMode}
              aria-label={isDarkMode ? 'Switch to light mode' : 'Switch to dark mode'}
              suppressHydrationWarning
            >
              {isDarkMode ? <Sun size={20} /> : <Moon size={20} />}
            </button>
          </div>
        </div>
        <div className="search-section">
          <div className="search-bar">
            <Search className="search-icon" size={20} aria-hidden="true" />
            <input
              type="text"
              placeholder="Search by name or category..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              aria-label="Search posters"
              suppressHydrationWarning
            />
          </div>
        </div>
        <div className="filter-row">
          <select
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
            className="filter-select"
            aria-label="Select category"
            suppressHydrationWarning
          >
            {['All', 'Festival', 'Birthday', 'Marriage'].map(category => (
              <option key={category} value={category}>
                {category}
              </option>
            ))}
          </select>
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as 'latest' | 'popular')}
            className="sort-select"
            aria-label="Sort posters"
            suppressHydrationWarning
          >
            <option value="latest">Latest</option>
            <option value="popular">Most Popular</option>
          </select>
        </div>
      </header>

      <section className="banner" aria-label="Category selection">
        <div className="banner-content">
          <CategoryScroll
            selectedCategory={selectedCategory}
            setSelectedCategory={setSelectedCategory}
          />
        </div>
      </section>

      {errorMessage && (
        <motion.div
          className="error-message"
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -10 }}
          role="alert"
        >
          {errorMessage}
          <button
            onClick={() => setErrorMessage(null)}
            aria-label="Dismiss error"
            className="error-close"
          >
            ×
          </button>
        </motion.div>
      )}

      <section className="posters-section" aria-label="Poster gallery">
        <AnimatePresence>
          {loading ? (
            <div className="skeleton-grid">
              {[...Array(6)].map((_, i) => (
                <div key={i} className="skeleton-card" aria-hidden="true" />
              ))}
            </div>
          ) : (
            <motion.div
              className="posters-grid"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.5 }}
            >
              {filteredPosters.map(poster => (
                <motion.div
                  key={poster.id}
                  className="poster-card"
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.3 }}
                  role="article"
                  aria-label={`Poster: ${poster.title}`}
                >
                  <div className="poster-image-container">
                    <Image
                      src={poster.download_url || poster.psd_url || '/placeholder.png'}
                      alt={poster.title}
                      fill
                      sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
                      className="poster-image"
                      {...(filteredPosters.indexOf(poster) < 3
                        ? { priority: true }
                        : { loading: 'lazy' })}
                    />
                    {poster.is_editable && (
                      <span className="editable-badge">Editable</span>
                    )}
                  </div>
                  <div className="poster-info">
                    <h4>{poster.title}</h4>
                    <div className="poster-meta">
                      <span className="poster-category">{poster.category}</span>
                      <span className="download-count">
                        <Download className="download-icon" size={16} aria-hidden="true" />
                        <span>{poster.download_count || 0}</span>
                      </span>
                    </div>
                    <div className="poster-actions">
                      <motion.button
                        className="download-btn"
                        whileHover={{ scale: countdowns[poster.id] ? 1 : 1.05 }}
                        whileTap={{ scale: countdowns[poster.id] ? 1 : 0.95 }}
                        onClick={() => handleDownload(poster.id, poster.download_url || poster.psd_url || '', poster.title)}
                        disabled={!!countdowns[poster.id]}
                        aria-label={countdowns[poster.id] ? `Downloading ${poster.title} in ${countdowns[poster.id]} seconds` : `Download ${poster.title}`}
                        suppressHydrationWarning
                      >
                        {countdowns[poster.id] ? (
                          <>
                            <span className="loading-spinner" aria-hidden="true" />
                            <span>Download starts in {countdowns[poster.id]}s</span>
                          </>
                        ) : (
                          <>
                            <Download className="download-icon" size={18} aria-hidden="true" />
                            <span>Download</span>
                          </>
                        )}
                      </motion.button>
                      {poster.is_editable && (
                        <motion.button
                          className="edit-btn"
                          whileHover={{ scale: 1.05 }}
                          whileTap={{ scale: 0.95 }}
                          onClick={() => {
                            console.log('Edit button clicked for poster:', poster);
                            setEditingPoster(poster);
                          }}
                          aria-label={`Edit ${poster.title}`}
                          suppressHydrationWarning
                        >
                          <LucideEdit size={18} aria-hidden="true" />
                          <span>Edit</span>
                        </motion.button>
                      )}
                    </div>
                  </div>
                </motion.div>
              ))}
            </motion.div>
          )}
        </AnimatePresence>
      </section>

      <AnimatePresence>
        {editingPoster && (
          <motion.div
            className="modal"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3 }}
          >
            <div className="modal-content">
              <h2>Customize Poster</h2>
              <div className="form-wrapper">
                <div className="preview-container" ref={canvasRef}>
                  <div ref={previewRef} className="preview-content">
                    <Image
                      src={editingPoster.download_url || editingPoster.psd_url || '/placeholder.png'}
                      alt="Base Poster"
                      width={400}
                      height={280}
                      className="preview-base"
                      style={{ transform: `scale(${zoomLevel})`, transformOrigin: 'center' }}
                    />
                    {editFormData.name && (
                      <motion.div
                        ref={textRef}
                        drag
                        dragMomentum={false}
                        onDrag={handleTextDrag}
                        className="draggable-item draggable-text"
                        style={{
                          position: 'absolute',
                          left: editFormData.textPosition.x,
                          top: editFormData.textPosition.y,
                          color: editFormData.textColor,
                          fontSize: editFormData.fontSize,
                          fontFamily: editFormData.fontFamily,
                          fontStyle: editFormData.fontStyle,
                          fontWeight: editFormData.fontWeight,
                          transform: `rotate(${editFormData.textRotation}deg) scale(${zoomLevel})`,
                          textShadow: '0 0 4px rgba(0, 0, 0, 0.3)',
                          whiteSpace: 'nowrap',
                          zIndex: 10,
                        }}
                      >
                        {editFormData.name}
                      </motion.div>
                    )}
                    {editFormData.image && (
                      <motion.div
                        ref={imageRef}
                        drag
                        dragMomentum={false}
                        onDrag={handleImageDrag}
                        className="draggable-item draggable-image"
                        style={{
                          position: 'absolute',
                          left: editFormData.imagePosition.x,
                          top: editFormData.imagePosition.y,
                          transform: `rotate(${editFormData.imageRotation}deg) scale(${zoomLevel})`,
                          zIndex: 10,
                        }}
                      >
                        <div className="image-wrapper">
                          <img
                            src={URL.createObjectURL(editFormData.image)}
                            alt="User Image"
                            style={{
                              width: `${editFormData.imageSize.width}px`,
                              height: `${editFormData.imageSize.height}px`,
                              border: '2px solid var(--gold-primary)',
                              borderRadius: 'var(--radius-sm)',
                              boxShadow: 'var(--shadow-md)',
                            }}
                          />
                          <div
                            className="resize-handle bottom-right"
                            onMouseDown={(e) => handleResizeStart(e, 'bottom-right')}
                            onTouchStart={(e) => handleResizeStart(e, 'bottom-right')}
                          />
                          <div
                            className="resize-handle top-left"
                            onMouseDown={(e) => handleResizeStart(e, 'top-left')}
                            onTouchStart={(e) => handleResizeStart(e, 'top-left')}
                          />
                          <div
                            className="rotate-handle"
                            onMouseDown={(e) => handleRotateStart(e)}
                            onTouchStart={(e) => handleRotateStart(e)}
                          />
                        </div>
                      </motion.div>
                    )}
                  </div>
                  <div className="scroll-controls">
                    <button onClick={() => handleScrollPreview('up')} aria-label="Scroll up">
                      <ChevronUp size={20} />
                    </button>
                    <button onClick={() => handleScrollPreview('down')} aria-label="Scroll down">
                      <ChevronDown size={20} />
                    </button>
                  </div>
                  <div className="zoom-controls">
                    <button onClick={() => handleZoom(-0.1)} aria-label="Zoom out">-</button>
                    <span>{(zoomLevel * 100).toFixed(0)}%</span>
                    <button onClick={() => handleZoom(0.1)} aria-label="Zoom in">+</button>
                  </div>
                </div>
                <div>
                  <div className="form-group">
                    <label>Your Name</label>
                    <input
                      type="text"
                      name="name"
                      value={editFormData.name}
                      onChange={handleEditInputChange}
                      placeholder="Enter your name"
                      maxLength={50}
                    />
                  </div>
                  <div className="form-group">
                    <label>Text Color</label>
                    <input
                      type="color"
                      name="textColor"
                      value={editFormData.textColor}
                      onChange={handleEditInputChange}
                    />
                  </div>
                  <div className="form-group">
                    <label>Font Family</label>
                    <select
                      name="fontFamily"
                      value={editFormData.fontFamily}
                      onChange={handleEditInputChange}
                    >
                      <option value="Arial">Arial</option>
                      <option value="Georgia">Georgia</option>
                      <option value="Times New Roman">Times New Roman</option>
                      <option value="Verdana">Verdana</option>
                      <option value="Courier New">Courier New</option>
                      <option value="Impact">Impact</option>
                      <option value="Roboto">Roboto</option>
                      <option value="Montserrat">Montserrat</option>
                      <option value="Poppins">Poppins</option>
                    </select>
                  </div>
                  <div className="form-group">
                    <label>Font Style</label>
                    <select
                      name="fontStyle"
                      value={editFormData.fontStyle}
                      onChange={handleEditInputChange}
                    >
                      <option value="normal">Normal</option>
                      <option value="italic">Italic</option>
                    </select>
                  </div>
                  <div className="form-group">
                    <label>Font Weight</label>
                    <select
                      name="fontWeight"
                      value={editFormData.fontWeight}
                      onChange={handleEditInputChange}
                    >
                      <option value="normal">Normal</option>
                      <option value="bold">Bold</option>
                    </select>
                  </div>
                  <div className="form-group">
                    <label>Font Size</label>
                    <div className="control-buttons">
                      <button onClick={() => handleFontSizeChange(-2)}>-</button>
                      <span>{editFormData.fontSize}px</span>
                      <button onClick={() => handleFontSizeChange(2)}>+</button>
                    </div>
                  </div>
                  <div className="form-group">
                    <label>Text Rotation</label>
                    <div className="control-buttons">
                      <button onClick={() => handleRotationChange('text', -15)}>-</button>
                      <span>{editFormData.textRotation}°</span>
                      <button onClick={() => handleRotationChange('text', 15)}>+</button>
                    </div>
                  </div>
                  <div className="form-group">
                    <label>Upload Image (PNG only, max 5MB, optional)</label>
                    <input
                      type="file"
                      name="image"
                      accept="image/png"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file && file.size > 5 * 1024 * 1024) {
                          setErrorMessage('Uploaded image exceeds 5MB limit.');
                          return;
                        }
                        handleEditInputChange(e);
                      }}
                    />
                  </div>
                  {editFormData.image && (
                    <>
                      <div className="form-group">
                        <label>Image Size</label>
                        <div className="control-buttons">
                          <button onClick={() => handleImageSizeChange(-10, -10)}>-</button>
                          <span>{editFormData.imageSize.width}x{editFormData.imageSize.height}</span>
                          <button onClick={() => handleImageSizeChange(10, 10)}>+</button>
                        </div>
                      </div>
                      <div className="form-group">
                        <label>Image Rotation</label>
                        <div className="control-buttons">
                          <button onClick={() => handleRotationChange('image', -15)}>-</button>
                          <span>{editFormData.imageRotation}°</span>
                          <button onClick={() => handleRotationChange('image', 15)}>+</button>
                        </div>
                      </div>
                    </>
                  )}
                </div>
              </div>
              <div className="modal-actions">
                <button
                  className="submit-button"
                  onClick={handleEditSave}
                >
                  <Download size={18} aria-hidden="true" />
                  Download Customized Poster
                </button>
                <button className="cancel-button" onClick={closeEditModal}>
                  Cancel
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <motion.button
        className="wish-generator"
        whileHover={{ scale: 1.1 }}
        whileTap={{ scale: 0.95 }}
        aria-label="Open Wish Generator"
        suppressHydrationWarning
      >
        <Sparkles size={20} aria-hidden="true" />
        <span>Wish Generator</span>
      </motion.button>

      <footer className="footer" role="contentinfo">
        <p>© 2025 WishMe • Made with 💖 by Vardhan Raju</p>
      </footer>
    </div>
  );
}