import { useState } from 'react';
import {
  Box,
  Typography,
  TextField,
  Button,
  IconButton,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Chip,
  Paper,
  Alert,
  CircularProgress,
} from '@mui/material';
import {
  Delete as DeleteIcon,
  Add as AddIcon,
  Image as ImageIcon,
  Edit as EditIcon,
} from '@mui/icons-material';
import { EventImage, EventImages } from '../../api/groups.api';

interface EventImagesManagerProps {
  images: EventImages | undefined;
  onAddImage: (data: {
    url: string;
    alt_text?: string;
    image_type: 'banner' | 'gallery';
    sort_order?: number;
  }) => Promise<void>;
  onDeleteImage: (imageId: string) => Promise<void>;
  onUpdateImage: (imageId: string, data: { alt_text?: string; sort_order?: number }) => Promise<void>;
}

export function EventImagesManager({ images, onAddImage, onDeleteImage, onUpdateImage }: EventImagesManagerProps) {
  const [url, setUrl] = useState('');
  const [altText, setAltText] = useState('');
  const [imageType, setImageType] = useState<'banner' | 'gallery'>('gallery');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editAltText, setEditAltText] = useState('');

  const banner = images?.banner;
  const gallery = images?.gallery || [];

  const handleAdd = async () => {
    if (!url.trim()) {
      setError('Image URL is required');
      return;
    }

    // Validate URL format
    try {
      new URL(url.trim());
    } catch {
      setError('Please enter a valid URL');
      return;
    }

    setLoading(true);
    setError('');
    setSuccess('');

    try {
      await onAddImage({
        url: url.trim(),
        alt_text: altText.trim() || undefined,
        image_type: imageType,
      });
      setSuccess('Image added successfully');
      setUrl('');
      setAltText('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add image');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (imageId: string) => {
    if (!window.confirm('Delete this image?')) return;
    try {
      await onDeleteImage(imageId);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete image');
    }
  };

  const startEdit = (image: EventImage) => {
    setEditingId(image.id);
    setEditAltText(image.alt_text || '');
  };

  const saveEdit = async (imageId: string) => {
    try {
      await onUpdateImage(imageId, { alt_text: editAltText.trim() || undefined });
      setEditingId(null);
      setEditAltText('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update image');
    }
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditAltText('');
  };

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
      {/* Current Banner */}
      <Box>
        <Typography variant="subtitle2" gutterBottom sx={{ fontWeight: 700, color: 'text.secondary' }}>
          Current Banner
        </Typography>
        {banner ? (
          <Paper
            sx={{
              p: 2,
              bgcolor: 'background.paper',
              border: 1,
              borderColor: 'divider',
              borderRadius: 2,
            }}
          >
            <Box sx={{ display: 'flex', gap: 2, alignItems: 'flex-start' }}>
              <Box
                sx={{
                  width: 120,
                  height: 68,
                  borderRadius: 1,
                  overflow: 'hidden',
                  flexShrink: 0,
                  bgcolor: 'background.default',
                }}
              >
                <img
                  src={banner.url}
                  alt={banner.alt_text || 'Banner'}
                  style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                />
              </Box>
              <Box sx={{ flex: 1, minWidth: 0 }}>
                {editingId === banner.id ? (
                  <Box sx={{ display: 'flex', gap: 1, alignItems: 'center', mb: 1 }}>
                    <TextField
                      size="small"
                      value={editAltText}
                      onChange={(e) => setEditAltText(e.target.value)}
                      placeholder="Alt text"
                      sx={{ flex: 1 }}
                    />
                    <Button size="small" onClick={() => saveEdit(banner.id)}>
                      Save
                    </Button>
                    <Button size="small" onClick={cancelEdit}>
                      Cancel
                    </Button>
                  </Box>
                ) : (
                  <>
                    <Typography variant="body2" sx={{ wordBreak: 'break-all', color: 'text.secondary', mb: 0.5 }}>
                      {banner.url}
                    </Typography>
                    {banner.alt_text && (
                      <Typography variant="caption" color="text.disabled">
                        Alt: {banner.alt_text}
                      </Typography>
                    )}
                  </>
                )}
                <Box sx={{ display: 'flex', gap: 0.5, mt: 1 }}>
                  <Chip label="banner" size="small" color="primary" variant="outlined" />
                  <IconButton size="small" onClick={() => startEdit(banner)}>
                    <EditIcon fontSize="small" />
                  </IconButton>
                  <IconButton size="small" color="error" onClick={() => handleDelete(banner.id)}>
                    <DeleteIcon fontSize="small" />
                  </IconButton>
                </Box>
              </Box>
            </Box>
          </Paper>
        ) : (
          <Box
            sx={{
              p: 2,
              borderRadius: 2,
              border: '1px dashed',
              borderColor: 'divider',
              textAlign: 'center',
              color: 'text.disabled',
            }}
          >
            <ImageIcon sx={{ fontSize: 32, mb: 1 }} />
            <Typography variant="body2">No banner image set</Typography>
          </Box>
        )}
      </Box>

      {/* Gallery Images */}
      <Box>
        <Typography variant="subtitle2" gutterBottom sx={{ fontWeight: 700, color: 'text.secondary' }}>
          Gallery ({gallery.length})
        </Typography>
        {gallery.length === 0 ? (
          <Box
            sx={{
              p: 2,
              borderRadius: 2,
              border: '1px dashed',
              borderColor: 'divider',
              textAlign: 'center',
              color: 'text.disabled',
            }}
          >
            <Typography variant="body2">No gallery images</Typography>
          </Box>
        ) : (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
            {gallery.map((img) => (
              <Paper
                key={img.id}
                sx={{
                  p: 1.5,
                  bgcolor: 'background.paper',
                  border: 1,
                  borderColor: 'divider',
                  borderRadius: 2,
                }}
              >
                <Box sx={{ display: 'flex', gap: 2, alignItems: 'flex-start' }}>
                  <Box
                    sx={{
                      width: 80,
                      height: 60,
                      borderRadius: 1,
                      overflow: 'hidden',
                      flexShrink: 0,
                      bgcolor: 'background.default',
                    }}
                  >
                    <img
                      src={img.url}
                      alt={img.alt_text || 'Gallery image'}
                      style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                    />
                  </Box>
                  <Box sx={{ flex: 1, minWidth: 0 }}>
                    {editingId === img.id ? (
                      <Box sx={{ display: 'flex', gap: 1, alignItems: 'center', mb: 1 }}>
                        <TextField
                          size="small"
                          value={editAltText}
                          onChange={(e) => setEditAltText(e.target.value)}
                          placeholder="Alt text"
                          sx={{ flex: 1 }}
                        />
                        <Button size="small" onClick={() => saveEdit(img.id)}>
                          Save
                        </Button>
                        <Button size="small" onClick={cancelEdit}>
                          Cancel
                        </Button>
                      </Box>
                    ) : (
                      <>
                        <Typography
                          variant="body2"
                          sx={{ wordBreak: 'break-all', color: 'text.secondary', mb: 0.5 }}
                        >
                          {img.url}
                        </Typography>
                        {img.alt_text && (
                          <Typography variant="caption" color="text.disabled">
                            Alt: {img.alt_text}
                          </Typography>
                        )}
                      </>
                    )}
                    <Box sx={{ display: 'flex', gap: 0.5, mt: 1, alignItems: 'center' }}>
                      <Chip label="gallery" size="small" variant="outlined" />
                      <Typography variant="caption" color="text.disabled" sx={{ ml: 1 }}>
                        Order: {img.sort_order}
                      </Typography>
                      <IconButton size="small" onClick={() => startEdit(img)}>
                        <EditIcon fontSize="small" />
                      </IconButton>
                      <IconButton size="small" color="error" onClick={() => handleDelete(img.id)}>
                        <DeleteIcon fontSize="small" />
                      </IconButton>
                    </Box>
                  </Box>
                </Box>
              </Paper>
            ))}
          </Box>
        )}
      </Box>

      {/* Add Image Form */}
      <Paper
        sx={{
          p: 2.5,
          bgcolor: 'background.paper',
          border: 1,
          borderColor: 'divider',
          borderRadius: 2,
        }}
      >
        <Typography variant="subtitle2" gutterBottom sx={{ fontWeight: 700, display: 'flex', alignItems: 'center', gap: 1 }}>
          <AddIcon fontSize="small" />
          Add Image
        </Typography>
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
          <TextField
            label="Image URL"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://example.com/image.jpg"
            fullWidth
            size="small"
          />
          <TextField
            label="Alt Text (optional)"
            value={altText}
            onChange={(e) => setAltText(e.target.value)}
            placeholder="Describe the image"
            fullWidth
            size="small"
          />
          <FormControl fullWidth size="small">
            <InputLabel>Image Type</InputLabel>
            <Select value={imageType} label="Image Type" onChange={(e) => setImageType(e.target.value as 'banner' | 'gallery')}>
              <MenuItem value="banner">Banner</MenuItem>
              <MenuItem value="gallery">Gallery</MenuItem>
            </Select>
          </FormControl>
          <Button
            variant="contained"
            onClick={handleAdd}
            disabled={loading || !url.trim()}
            startIcon={loading ? <CircularProgress size={20} /> : <AddIcon />}
            sx={{ alignSelf: 'flex-start' }}
          >
            {loading ? 'Adding...' : 'Add Image'}
          </Button>
        </Box>
      </Paper>

      {/* Messages */}
      {error && (
        <Alert severity="error" sx={{ mt: 1 }}>
          {error}
        </Alert>
      )}
      {success && (
        <Alert severity="success" sx={{ mt: 1 }}>
          {success}
        </Alert>
      )}
    </Box>
  );
}
