import { useState, useCallback } from 'react';
import { Box, Typography, Card, Button, Alert, LinearProgress, alpha, Chip } from '@mui/material';
import {
  UploadFile as UploadIcon,
  CheckCircle as SuccessIcon,
  Error as ErrorIcon,
  Download as DownloadIcon,
} from '@mui/icons-material';
import { useMutation, useQuery } from '@tanstack/react-query';
import { adminImportApi, ImportResult } from '../../api/admin/import.api';
import { CardSkeleton } from '../../components/ui/Skeleton';

export default function AdminImport() {
  const [dragActive, setDragActive] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [importResult, setImportResult] = useState<ImportResult | null>(null);

  const { data: stats, isLoading: statsLoading } = useQuery({
    queryKey: ['admin-import-stats'],
    queryFn: () => adminImportApi.getStats(),
  });

  const importMutation = useMutation({
    mutationFn: (file: File) => adminImportApi.importCsv(file),
    onSuccess: (result) => {
      setImportResult(result);
    },
  });

  const handleDrag = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    const files = e.dataTransfer.files;
    if (files && files[0]) {
      const file = files[0];
      if (file.name.endsWith('.csv') || file.type === 'text/csv') {
        setSelectedFile(file);
        setImportResult(null);
      }
    }
  }, []);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setSelectedFile(e.target.files[0]);
      setImportResult(null);
    }
  };

  const handleImport = () => {
    if (selectedFile) {
      importMutation.mutate(selectedFile);
    }
  };

  const handleReset = () => {
    setSelectedFile(null);
    setImportResult(null);
  };

  return (
    <Box>
      {/* Header */}
      <Box sx={{ mb: 3 }}>
        <Typography variant="h4" fontWeight={700} sx={{ color: '#f3f4f6' }}>
          Summon Survivors
        </Typography>
        <Typography variant="body2" color="text.secondary">
          Import users from a CSV roster. The pit awaits new blood.
        </Typography>
      </Box>

      {/* Stats */}
      {statsLoading ? (
        <CardSkeleton count={1} />
      ) : stats ? (
        <Box sx={{ display: 'flex', gap: 2, mb: 3, flexWrap: 'wrap' }}>
          <Card sx={{ p: 2, flex: 1, minWidth: 150 }}>
            <Typography variant="caption" color="text.secondary">
              Total Imports
            </Typography>
            <Typography variant="h5" fontWeight={700}>
              {stats.total_imports}
            </Typography>
          </Card>
          <Card sx={{ p: 2, flex: 1, minWidth: 150 }}>
            <Typography variant="caption" color="text.secondary">
              Survivors Summoned
            </Typography>
            <Typography variant="h5" fontWeight={700}>
              {stats.total_survivors_summoned}
            </Typography>
          </Card>
          {stats.last_import_at && (
            <Card sx={{ p: 2, flex: 1, minWidth: 150 }}>
              <Typography variant="caption" color="text.secondary">
                Last Import
              </Typography>
              <Typography variant="body2" fontWeight={500}>
                {new Date(stats.last_import_at).toLocaleString()}
              </Typography>
            </Card>
          )}
        </Box>
      ) : null}

      {/* Upload Zone */}
      <Card
        sx={{
          mb: 3,
          p: 0,
          border: '2px dashed',
          borderColor: dragActive ? '#f59e0b' : alpha('#f59e0b', 0.2),
          backgroundColor: dragActive ? alpha('#f59e0b', 0.05) : 'transparent',
          transition: 'all 0.2s ease',
        }}
        onDragEnter={handleDrag}
        onDragLeave={handleDrag}
        onDragOver={handleDrag}
        onDrop={handleDrop}
      >
        <Box sx={{ p: 6, textAlign: 'center' }}>
          <Box
            sx={{
              width: 64,
              height: 64,
              borderRadius: '50%',
              backgroundColor: alpha('#f59e0b', 0.1),
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              mb: 2,
            }}
          >
            <UploadIcon sx={{ fontSize: 32, color: '#f59e0b' }} />
          </Box>
          <Typography variant="h6" fontWeight={600} gutterBottom>
            Drop your CSV here
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            or click to browse. Expected columns: <code>name,email</code>
          </Typography>
          <input
            type="file"
            accept=".csv,text/csv"
            onChange={handleFileSelect}
            style={{ display: 'none' }}
            id="csv-upload"
          />
          <label htmlFor="csv-upload">
            <Button variant="outlined" component="span" sx={{ borderColor: '#f59e0b', color: '#f59e0b' }}>
              Select File
            </Button>
          </label>
        </Box>
      </Card>

      {/* Selected File */}
      {selectedFile && !importResult && (
        <Card sx={{ mb: 3, p: 3 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 2 }}>
            <Box
              sx={{
                width: 40,
                height: 40,
                borderRadius: 2,
                backgroundColor: alpha('#f59e0b', 0.1),
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <DownloadIcon sx={{ color: '#f59e0b' }} />
            </Box>
            <Box sx={{ flex: 1 }}>
              <Typography variant="body2" fontWeight={500}>
                {selectedFile.name}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                {(selectedFile.size / 1024).toFixed(1)} KB
              </Typography>
            </Box>
            <Button size="small" onClick={handleReset}>
              Remove
            </Button>
          </Box>
          <Button
            variant="contained"
            fullWidth
            onClick={handleImport}
            disabled={importMutation.isPending}
            sx={{
              backgroundColor: '#f59e0b',
              color: '#121212',
              fontWeight: 700,
              '&:hover': { backgroundColor: '#d97706' },
            }}
          >
            {importMutation.isPending ? 'Summoning...' : 'Summon Survivors'}
          </Button>
          {importMutation.isPending && <LinearProgress sx={{ mt: 2 }} />}
        </Card>
      )}

      {/* Import Result */}
      {importResult && (
        <Card sx={{ mb: 3, p: 3 }}>
          <Typography variant="h6" fontWeight={600} gutterBottom>
            Import Result
          </Typography>

          {importResult.success ? (
            <Alert severity="success" icon={<SuccessIcon />} sx={{ mb: 2 }}>
              Honor Restored! {importResult.imported_count} survivor(s) summoned successfully.
            </Alert>
          ) : (
            <Alert severity="error" icon={<ErrorIcon />} sx={{ mb: 2 }}>
              Import completed with errors. {importResult.imported_count} succeeded, {importResult.failed_count} failed.
            </Alert>
          )}

          {importResult.errors.length > 0 && (
            <Box sx={{ mb: 2 }}>
              <Typography variant="body2" fontWeight={600} gutterBottom>
                Errors:
              </Typography>
              {importResult.errors.map((err, i) => (
                <Typography key={i} variant="caption" color="error" sx={{ display: 'block' }}>
                  • {err}
                </Typography>
              ))}
            </Box>
          )}

          {importResult.survivors.length > 0 && (
            <Box sx={{ maxHeight: 200, overflow: 'auto' }}>
              <Typography variant="body2" fontWeight={600} gutterBottom>
                Survivors:
              </Typography>
              {importResult.survivors.map((s) => (
                <Typography key={s.id} variant="body2" sx={{ mb: 0.5 }}>
                  <Chip
                    label={s.status}
                    size="small"
                    color={s.status === 'created' ? 'success' : s.status === 'invited' ? 'warning' : 'default'}
                    sx={{ mr: 1, textTransform: 'capitalize' }}
                  />
                  {s.name} ({s.email})
                </Typography>
              ))}
            </Box>
          )}

          <Button onClick={handleReset} sx={{ mt: 2 }}>
            Import Another
          </Button>
        </Card>
      )}

      {/* CSV Format Help */}
      <Card sx={{ p: 3 }}>
        <Typography variant="body2" fontWeight={600} gutterBottom>
          Expected CSV Format
        </Typography>
        <Box
          sx={{
            backgroundColor: '#1a1a1a',
            p: 2,
            borderRadius: 2,
            fontFamily: 'monospace',
            fontSize: '0.8125rem',
            color: '#9ca3af',
          }}
        >
          <div>name,email</div>
          <div>John Doe,john@example.com</div>
          <div>Jane Smith,jane@example.com</div>
        </Box>
      </Card>
    </Box>
  );
}
