import React, { useState, useEffect, useRef } from 'react';
import { FileText, Plus, Edit2, Trash2, Upload, Save, X, Flag, File, Image as ImageIcon, CheckCircle, AlertCircle } from 'lucide-react';
import { triggerConfetti, toast } from '../utils/animations';

const MyDocumentsPage = () => {
  const [documents, setDocuments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingDoc, setEditingDoc] = useState(null);
  const [formData, setFormData] = useState({
    document_type: 'PASSPORT',
    country: '',
    document_number: '',
    document_data: {}
  });
  const [uploadingFile, setUploadingFile] = useState(null);
  const [uploadProgress, setUploadProgress] = useState({});
  const [selectedFile, setSelectedFile] = useState(null);
  const [filePreview, setFilePreview] = useState(null);
  const [uploadError, setUploadError] = useState(null);
  const fileInputRef = useRef(null);

  const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;

  const documentTypes = [
    { value: 'PASSPORT', label: 'Паспорт (Внутренний)', icon: '🛂', color: '#DC2626' },
    { value: 'TRAVELING_PASSPORT', label: 'Загранпаспорт', icon: '🛫', color: '#2563EB' },
    { value: 'DRIVERS_LICENSE', label: 'Водительское Удостоверение', icon: '🚗', color: '#059669' }
  ];

  // Helper function to get file type icon
  const getFileIcon = (file) => {
    if (file.type.startsWith('image/')) {
      return <ImageIcon size={24} color="#059669" />;
    } else if (file.type.includes('pdf')) {
      return <FileText size={24} color="#DC2626" />;
    } else {
      return <File size={24} color="#6B7280" />;
    }
  };

  // Helper function to get file gradient background
  const getFileGradient = (type) => {
    if (type.includes('pdf')) {
      return 'linear-gradient(135deg, #DC2626 0%, #B91C1C 100%)';
    } else if (type.startsWith('image/')) {
      return 'linear-gradient(135deg, #059669 0%, #047857 100%)';
    } else {
      return 'linear-gradient(135deg, #6B7280 0%, #4B5563 100%)';
    }
  };

  useEffect(() => {
    fetchDocuments();
  }, []);

  const fetchDocuments = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('zion_token');
      const response = await fetch(`${BACKEND_URL}/api/my-documents`, {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (response.ok) {
        const data = await response.json();
        setDocuments(data);
      }
    } catch (error) {
      console.error('Error fetching documents:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleAddDocument = async (e) => {
    e.preventDefault();
    try {
      const token = localStorage.getItem('zion_token');
      const response = await fetch(`${BACKEND_URL}/api/my-documents`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(formData)
      });

      if (response.ok) {
        await fetchDocuments();
        setShowAddForm(false);
        resetForm();
      }
    } catch (error) {
      console.error('Error adding document:', error);
    }
  };

  const handleUpdateDocument = async (documentId) => {
    try {
      const token = localStorage.getItem('zion_token');
      const response = await fetch(`${BACKEND_URL}/api/my-documents/${documentId}`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          country: formData.country,
          document_number: formData.document_number,
          document_data: formData.document_data
        })
      });

      if (response.ok) {
        await fetchDocuments();
        setEditingDoc(null);
        resetForm();
      }
    } catch (error) {
      console.error('Error updating document:', error);
    }
  };

  const handleDeleteDocument = async (documentId) => {
    if (!window.confirm('Вы уверены, что хотите удалить этот документ?')) return;

    try {
      const token = localStorage.getItem('zion_token');
      const response = await fetch(`${BACKEND_URL}/api/my-documents/${documentId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (response.ok) {
        await fetchDocuments();
      }
    } catch (error) {
      console.error('Error deleting document:', error);
    }
  };

  // Enhanced upload with chunked upload support
  const handleUploadScan = async (documentId, file) => {
    try {
      // Validate file
      const validation = validateFile(file);
      if (!validation.isValid) {
        setUploadError(validation.error);
        setTimeout(() => setUploadError(null), 5000);
        return;
      }

      setUploadingFile(documentId);
      setUploadError(null);
      setUploadProgress({ [documentId]: 0 });

      const token = localStorage.getItem('zion_token');
      
      // Use chunked upload for large files
      if (file.size > 5 * 1024 * 1024) { // Files > 5MB
        await chunkedUpload(documentId, file, token);
      } else {
        await simpleUpload(documentId, file, token);
      }

      // Success - refresh documents
      await fetchDocuments();
      setSelectedFile(null);
      setFilePreview(null);
      
    } catch (error) {
      console.error('Error uploading scan:', error);
      setUploadError(error.message || 'Ошибка загрузки файла');
      setTimeout(() => setUploadError(null), 5000);
    } finally {
      setUploadingFile(null);
      setUploadProgress({});
    }
  };

  // Simple upload for smaller files
  const simpleUpload = async (documentId, file, token) => {
    const formDataUpload = new FormData();
    formDataUpload.append('file', file);

    const response = await fetch(`${BACKEND_URL}/api/my-documents/${documentId}/upload-scan`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
      },
      body: formDataUpload
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ detail: 'Upload failed' }));
      throw new Error(error.detail || 'Upload failed');
    }

    setUploadProgress({ [documentId]: 100 });
  };

  // Chunked upload for larger files
  const chunkedUpload = async (documentId, file, token) => {
    const chunkSize = 1 * 1024 * 1024; // 1MB chunks
    const totalChunks = Math.ceil(file.size / chunkSize);
    
    for (let chunkIndex = 0; chunkIndex < totalChunks; chunkIndex++) {
      const start = chunkIndex * chunkSize;
      const end = Math.min(start + chunkSize, file.size);
      const chunk = file.slice(start, end);

      const formData = new FormData();
      formData.append('file', chunk);
      formData.append('chunk_index', chunkIndex);
      formData.append('total_chunks', totalChunks);
      formData.append('original_filename', file.name);

      const response = await fetch(`${BACKEND_URL}/api/my-documents/${documentId}/upload-scan`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
        body: formData
      });

      if (!response.ok) {
        const error = await response.json().catch(() => ({ detail: 'Chunk upload failed' }));
        throw new Error(error.detail || `Chunk ${chunkIndex + 1} upload failed`);
      }

      // Update progress
      const progress = Math.round(((chunkIndex + 1) / totalChunks) * 100);
      setUploadProgress({ [documentId]: progress });
    }
  };

  // Validate file type and size
  const validateFile = (file) => {
    const MAX_SIZE = 10 * 1024 * 1024; // 10MB
    const ALLOWED_TYPES = [
      'application/pdf',
      'image/jpeg',
      'image/jpg',
      'image/png',
      'image/gif',
      'image/webp'
    ];

    if (!file) {
      return { isValid: false, error: 'Файл не выбран' };
    }

    if (file.size > MAX_SIZE) {
      return { 
        isValid: false, 
        error: `Файл слишком большой. Максимальный размер: ${MAX_SIZE / (1024 * 1024)}MB` 
      };
    }

    if (!ALLOWED_TYPES.includes(file.type)) {
      return { 
        isValid: false, 
        error: 'Неподдерживаемый тип файла. Разрешены: PDF, JPG, PNG, GIF, WEBP' 
      };
    }

    return { isValid: true };
  };

  // Handle file selection with preview
  const handleFileSelect = (documentId, event) => {
    const file = event.target.files[0];
    if (!file) return;

    // Validate file
    const validation = validateFile(file);
    if (!validation.isValid) {
      setUploadError(validation.error);
      setTimeout(() => setUploadError(null), 5000);
      return;
    }

    setSelectedFile({ documentId, file });
    setUploadError(null);

    // Generate preview for images
    if (file.type.startsWith('image/')) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setFilePreview(reader.result);
      };
      reader.readAsDataURL(file);
    } else {
      setFilePreview(null);
    }

    // Auto-upload
    handleUploadScan(documentId, file);
  };

  const resetForm = () => {
    setFormData({
      document_type: 'PASSPORT',
      country: '',
      document_number: '',
      document_data: {}
    });
  };

  const startEditing = (doc) => {
    setEditingDoc(doc.id);
    setFormData({
      document_type: doc.document_type,
      country: doc.country,
      document_number: doc.document_number || '',
      document_data: doc.document_data || {}
    });
  };

  const getDocumentTypeLabel = (type) => {
    const docType = documentTypes.find(dt => dt.value === type);
    return docType ? docType.label : type;
  };

  const getDocumentTypeIcon = (type) => {
    const docType = documentTypes.find(dt => dt.value === type);
    return docType ? docType.icon : '📄';
  };

  const renderDocumentFields = () => {
    // Render different fields based on document type
    const type = formData.document_type;
    const data = formData.document_data || {};

    const updateData = (key, value) => {
      setFormData({
        ...formData,
        document_data: { ...data, [key]: value }
      });
    };

    switch (type) {
      case 'PASSPORT':
        return (
          <>
            <div className="form-row">
              <div className="form-group">
                <label>Серия</label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="45 24"
                  value={data.series || ''}
                  onChange={(e) => updateData('series', e.target.value)}
                />
              </div>
              <div className="form-group">
                <label>Кем выдан</label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="ГУ МВД..."
                  value={data.issued_by || ''}
                  onChange={(e) => updateData('issued_by', e.target.value)}
                />
              </div>
            </div>
            <div className="form-row">
              <div className="form-group">
                <label>Дата выдачи</label>
                <input
                  type="date"
                  className="form-input"
                  value={data.issue_date || ''}
                  onChange={(e) => updateData('issue_date', e.target.value)}
                />
              </div>
              <div className="form-group">
                <label>Код подразделения</label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="770-071"
                  value={data.department_code || ''}
                  onChange={(e) => updateData('department_code', e.target.value)}
                />
              </div>
            </div>
          </>
        );

      case 'TRAVELING_PASSPORT':
        return (
          <>
            <div className="form-row">
              <div className="form-group">
                <label>Имя (латиницей)</label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="IVAN"
                  value={data.first_name || ''}
                  onChange={(e) => updateData('first_name', e.target.value)}
                />
              </div>
              <div className="form-group">
                <label>Фамилия (латиницей)</label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="IVANOV"
                  value={data.last_name || ''}
                  onChange={(e) => updateData('last_name', e.target.value)}
                />
              </div>
            </div>
            <div className="form-row">
              <div className="form-group">
                <label>Дата выдачи</label>
                <input
                  type="date"
                  className="form-input"
                  value={data.issue_date || ''}
                  onChange={(e) => updateData('issue_date', e.target.value)}
                />
              </div>
              <div className="form-group">
                <label>Дата окончания</label>
                <input
                  type="date"
                  className="form-input"
                  value={data.expiry_date || ''}
                  onChange={(e) => updateData('expiry_date', e.target.value)}
                />
              </div>
            </div>
          </>
        );

      case 'DRIVERS_LICENSE':
        return (
          <>
            <div className="form-row">
              <div className="form-group">
                <label>Дата выдачи</label>
                <input
                  type="date"
                  className="form-input"
                  value={data.issue_date || ''}
                  onChange={(e) => updateData('issue_date', e.target.value)}
                />
              </div>
              <div className="form-group">
                <label>Дата окончания</label>
                <input
                  type="date"
                  className="form-input"
                  value={data.expires || ''}
                  onChange={(e) => updateData('expires', e.target.value)}
                />
              </div>
            </div>
            <div className="form-row">
              <div className="form-group">
                <label>Выдано в</label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="МОСКВА"
                  value={data.issued_in || ''}
                  onChange={(e) => updateData('issued_in', e.target.value)}
                />
              </div>
              <div className="form-group">
                <label>Категории</label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="B, B1, M"
                  value={data.categories || ''}
                  onChange={(e) => updateData('categories', e.target.value)}
                />
              </div>
            </div>
          </>
        );

      default:
        return null;
    }
  };

  if (loading) {
    return (
      <div className="my-documents-page">
        <div className="loading-spinner">
          <div className="spinner"></div>
          <p>Загрузка документов...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="my-documents-page">
      <div className="page-header">
        <h1>
          <FileText size={28} />
          МОИ ДОКУМЕНТЫ
        </h1>
        <button 
          className="btn-primary"
          onClick={() => setShowAddForm(true)}
        >
          <Plus size={18} />
          Добавить документ
        </button>
      </div>

      {showAddForm && (
        <div className="document-form-modal">
          <div className="modal-overlay" onClick={() => setShowAddForm(false)}></div>
          <div className="modal-content">
            <div className="modal-header">
              <h2>Добавить новый документ</h2>
              <button className="btn-icon" onClick={() => setShowAddForm(false)}>
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleAddDocument}>
              <div className="form-group">
                <label>Тип документа</label>
                <select
                  className="form-input"
                  value={formData.document_type}
                  onChange={(e) => setFormData({ ...formData, document_type: e.target.value })}
                >
                  {documentTypes.map(type => (
                    <option key={type.value} value={type.value}>
                      {type.icon} {type.label}
                    </option>
                  ))}
                </select>
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label>Страна выдачи</label>
                  <input
                    type="text"
                    className="form-input"
                    placeholder="Россия"
                    required
                    value={formData.country}
                    onChange={(e) => setFormData({ ...formData, country: e.target.value })}
                  />
                </div>
                <div className="form-group">
                  <label>Номер документа</label>
                  <input
                    type="text"
                    className="form-input"
                    placeholder="1234567890"
                    value={formData.document_number}
                    onChange={(e) => setFormData({ ...formData, document_number: e.target.value })}
                  />
                </div>
              </div>

              {renderDocumentFields()}

              <div className="form-actions">
                <button type="submit" className="btn-primary">
                  <Save size={18} />
                  Сохранить документ
                </button>
                <button 
                  type="button" 
                  className="btn-secondary"
                  onClick={() => {
                    setShowAddForm(false);
                    resetForm();
                  }}
                >
                  Отмена
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <div className="documents-grid">
        {documents.length === 0 ? (
          <div className="empty-state">
            <FileText size={64} />
            <h3>Нет документов</h3>
            <p>Добавьте свой первый документ, нажав кнопку "Добавить документ"</p>
          </div>
        ) : (
          documents.map(doc => (
            <div key={doc.id} className="document-card">
              <div className="document-header">
                <div className="document-icon">{getDocumentTypeIcon(doc.document_type)}</div>
                <div className="document-title">
                  <h3>{getDocumentTypeLabel(doc.document_type)}</h3>
                  <p>
                    <Flag size={14} />
                    {doc.country}
                  </p>
                </div>
                <div className="document-actions">
                  <button 
                    className="btn-icon"
                    onClick={() => startEditing(doc)}
                    title="Редактировать"
                  >
                    <Edit2 size={16} />
                  </button>
                  <button 
                    className="btn-icon btn-danger"
                    onClick={() => handleDeleteDocument(doc.id)}
                    title="Удалить"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>

              {editingDoc === doc.id ? (
                <div className="document-edit-form">
                  <div className="form-group">
                    <label>Номер документа</label>
                    <input
                      type="text"
                      className="form-input"
                      value={formData.document_number}
                      onChange={(e) => setFormData({ ...formData, document_number: e.target.value })}
                    />
                  </div>
                  {renderDocumentFields()}
                  <div className="form-actions">
                    <button 
                      className="btn-primary btn-sm"
                      onClick={() => handleUpdateDocument(doc.id)}
                    >
                      <Save size={14} />
                      Сохранить
                    </button>
                    <button 
                      className="btn-secondary btn-sm"
                      onClick={() => {
                        setEditingDoc(null);
                        resetForm();
                      }}
                    >
                      Отмена
                    </button>
                  </div>
                </div>
              ) : (
                <>
                  <div className="document-info">
                    {doc.document_number && (
                      <div className="info-row">
                        <span className="label">Номер:</span>
                        <span className="value">{doc.document_number}</span>
                      </div>
                    )}
                    {Object.entries(doc.document_data || {}).map(([key, value]) => (
                      <div key={key} className="info-row">
                        <span className="label">{key}:</span>
                        <span className="value">{value}</span>
                      </div>
                    ))}
                  </div>

                  <div className="document-scan">
                    {doc.scan_file_url ? (
                      <div className="scan-preview">
                        <div className="scan-image-wrapper">
                          <img src={`${BACKEND_URL}${doc.scan_file_url}`} alt="Скан документа" />
                          <button 
                            className="btn-replace-scan"
                            onClick={() => fileInputRef.current?.click()}
                          >
                            <Upload size={16} />
                            Заменить скан
                          </button>
                        </div>
                        <input
                          ref={fileInputRef}
                          type="file"
                          accept="image/*,.pdf"
                          style={{ display: 'none' }}
                          onChange={(e) => handleFileSelect(doc.id, e)}
                        />
                      </div>
                    ) : (
                      <div className="upload-area">
                        {uploadingFile === doc.id ? (
                          <div className="upload-progress-container">
                            <div className="upload-spinner"></div>
                            <p className="uploading">Загрузка... {uploadProgress[doc.id] || 0}%</p>
                            <div className="progress-bar">
                              <div 
                                className="progress-fill"
                                style={{ width: `${uploadProgress[doc.id] || 0}%` }}
                              ></div>
                            </div>
                          </div>
                        ) : (
                          <>
                            <div className="upload-icon-wrapper">
                              <div className="upload-icon-bg">
                                <Upload size={32} />
                              </div>
                            </div>
                            <h4>Загрузить скан документа</h4>
                            <p className="upload-hint">PDF, JPG, PNG или GIF (макс. 10MB)</p>
                            <label className="btn-upload">
                              <File size={16} />
                              Выбрать файл
                              <input
                                type="file"
                                accept="image/jpeg,image/jpg,image/png,image/gif,image/webp,.pdf"
                                onChange={(e) => handleFileSelect(doc.id, e)}
                                style={{ display: 'none' }}
                              />
                            </label>
                            {uploadError && (
                              <div className="upload-error">
                                <AlertCircle size={16} />
                                {uploadError}
                              </div>
                            )}
                          </>
                        )}
                      </div>
                    )}
                  </div>
                </>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
};

export default MyDocumentsPage;
