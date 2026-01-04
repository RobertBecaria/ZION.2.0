import React, { useState, useRef } from 'react';
import { Send, X, Image, Paperclip, Bot, Check, Copy, Sparkles, FileText } from 'lucide-react';
import ERICAnalyzeButton from '../eric/ERICAnalyzeButton';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;

const WorkPostComposer = ({ organizationId, organizationName, onPostCreated }) => {
  const [content, setContent] = useState('');
  const [posting, setPosting] = useState(false);
  const [error, setError] = useState(null);
  const [selectedFiles, setSelectedFiles] = useState([]);
  const [uploadingFiles, setUploadingFiles] = useState(false);
  const [uploadedMediaIds, setUploadedMediaIds] = useState([]);
  const [ericAnalysis, setEricAnalysis] = useState(null);
  const [showAnalysisModal, setShowAnalysisModal] = useState(false);
  const [analysisCopied, setAnalysisCopied] = useState(false);
  const fileInputRef = useRef(null);

  const handleFileSelect = async (e) => {
    const files = Array.from(e.target.files);
    if (files.length === 0) return;

    setSelectedFiles(prev => [...prev, ...files]);
    setUploadingFiles(true);

    try {
      const token = localStorage.getItem('zion_token');
      const uploadPromises = files.map(async (file) => {
        const formData = new FormData();
        formData.append('file', file);
        formData.append('source_module', 'work');

        const response = await fetch(`${BACKEND_URL}/api/media/upload`, {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${token}` },
          body: formData
        });

        if (response.ok) {
          const result = await response.json();
          return result.id;
        }
        throw new Error(`Ошибка загрузки ${file.name}`);
      });

      const uploadedIds = await Promise.all(uploadPromises);
      setUploadedMediaIds(prev => [...prev, ...uploadedIds]);
    } catch (err) {
      console.error('Upload error:', err);
      setError('Ошибка загрузки файлов');
    } finally {
      setUploadingFiles(false);
    }
  };

  const removeFile = (index) => {
    setSelectedFiles(prev => prev.filter((_, i) => i !== index));
    setUploadedMediaIds(prev => prev.filter((_, i) => i !== index));
    if (ericAnalysis) setEricAnalysis(null);
  };

  const handleAnalysisComplete = (result) => {
    setEricAnalysis(result);
    setShowAnalysisModal(true);
  };

  const handleAnalysisError = (err) => {
    setError(err);
  };

  const copyAnalysis = () => {
    if (ericAnalysis?.analysis) {
      navigator.clipboard.writeText(ericAnalysis.analysis);
      setAnalysisCopied(true);
      setTimeout(() => setAnalysisCopied(false), 2000);
    }
  };

  const addAnalysisToPost = () => {
    if (ericAnalysis?.analysis) {
      setContent(prev => prev ? `${prev}\n\n📊 Анализ ERIC:\n${ericAnalysis.analysis}` : `📊 Анализ ERIC:\n${ericAnalysis.analysis}`);
      setShowAnalysisModal(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!content.trim() && selectedFiles.length === 0) return;

    setPosting(true);
    setError(null);

    try {
      const token = localStorage.getItem('zion_token');

      const response = await fetch(`${BACKEND_URL}/api/work/organizations/${organizationId}/posts`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ 
          content,
          media_file_ids: uploadedMediaIds
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || 'Не удалось создать пост');
      }

      const data = await response.json();
      setContent('');
      setSelectedFiles([]);
      setUploadedMediaIds([]);
      setEricAnalysis(null);
      onPostCreated && onPostCreated(data.post);
    } catch (err) {
      console.error('Create post error:', err);
      setError(err.message);
    } finally {
      setPosting(false);
    }
  };

  const getFileIcon = (file) => {
    if (file.type.startsWith('image/')) return <Image size={24} />;
    return <FileText size={24} />;
  };

  return (
    <div className="bg-white rounded-2xl shadow-md p-6 border border-gray-100 mb-6">
      <form onSubmit={handleSubmit}>
        <textarea
          value={content}
          onChange={(e) => setContent(e.target.value)}
          placeholder="Что у вас нового?..."
          rows={3}
          className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-orange-500 focus:border-transparent resize-none"
        />

        {/* File Previews */}
        {selectedFiles.length > 0 && (
          <div className="flex flex-wrap gap-3 mt-3">
            {selectedFiles.map((file, index) => (
              <div 
                key={index} 
                className="relative bg-gray-100 rounded-lg p-2 flex items-center gap-2 pr-8"
                style={{ minWidth: 150 }}
              >
                {file.type.startsWith('image/') ? (
                  <img 
                    src={URL.createObjectURL(file)} 
                    alt="" 
                    className="w-12 h-12 object-cover rounded"
                  />
                ) : (
                  <div className="w-12 h-12 bg-orange-100 rounded flex items-center justify-center text-orange-600">
                    {getFileIcon(file)}
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{file.name}</p>
                  <p className="text-xs text-gray-500">{(file.size / 1024).toFixed(0)} KB</p>
                </div>
                <button
                  type="button"
                  onClick={() => removeFile(index)}
                  className="absolute top-1 right-1 p-1 bg-red-100 rounded-full hover:bg-red-200"
                >
                  <X size={14} className="text-red-600" />
                </button>
                {/* ERIC Analyze Button */}
                <div className="absolute bottom-1 right-1">
                  <ERICAnalyzeButton
                    file={file}
                    context="work"
                    contextData={{ organizationId, organizationName }}
                    onAnalysisComplete={handleAnalysisComplete}
                    onError={handleAnalysisError}
                    variant="icon-only"
                  />
                </div>
              </div>
            ))}
          </div>
        )}

        {uploadingFiles && (
          <div className="mt-3 flex items-center gap-2 text-orange-600">
            <div className="w-4 h-4 border-2 border-orange-600 border-t-transparent rounded-full animate-spin"></div>
            <span className="text-sm">Загрузка файлов...</span>
          </div>
        )}

        {error && (
          <div className="mt-3 bg-red-50 border border-red-200 rounded-lg p-3">
            <p className="text-sm text-red-700">{error}</p>
          </div>
        )}

        <div className="flex items-center justify-between mt-4">
          <div className="flex items-center gap-2">
            {/* File upload buttons */}
            <button
              type="button"
              onClick={() => {
                fileInputRef.current.accept = "image/*,video/*";
                fileInputRef.current.click();
              }}
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              title="Добавить фото/видео"
            >
              <Image size={20} className="text-gray-600" />
            </button>
            <button
              type="button"
              onClick={() => {
                fileInputRef.current.accept = ".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt";
                fileInputRef.current.click();
              }}
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              title="Добавить документ"
            >
              <Paperclip size={20} className="text-gray-600" />
            </button>
            <input
              ref={fileInputRef}
              type="file"
              multiple
              onChange={handleFileSelect}
              style={{ display: 'none' }}
            />
            <p className="text-sm text-gray-500 ml-2">
              {content.length} / 5000 символов
            </p>
          </div>
          <div className="flex gap-3">
            {(content || selectedFiles.length > 0) && (
              <button
                type="button"
                onClick={() => {
                  setContent('');
                  setSelectedFiles([]);
                  setUploadedMediaIds([]);
                }}
                className="px-4 py-2 text-gray-600 hover:text-gray-900 font-medium transition-colors duration-200"
              >
                Очистить
              </button>
            )}
            <button
              type="submit"
              disabled={(!content.trim() && selectedFiles.length === 0) || posting}
              className="px-6 py-2 bg-gradient-to-r from-orange-500 to-orange-600 text-white rounded-xl font-semibold hover:shadow-lg transition-all duration-200 disabled:bg-gray-300 disabled:cursor-not-allowed flex items-center gap-2"
            >
              {posting ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                  Публикация...
                </>
              ) : (
                <>
                  <Send className="w-4 h-4" />
                  Опубликовать
                </>
              )}
            </button>
          </div>
        </div>
      </form>

      {/* ERIC Analysis Modal */}
      {showAnalysisModal && ericAnalysis && (
        <div 
          className="fixed inset-0 bg-black/50 flex items-center justify-center z-50"
          onClick={(e) => {
            if (e.target === e.currentTarget) setShowAnalysisModal(false);
          }}
        >
          <div className="bg-white rounded-2xl p-6 max-w-lg w-11/12 max-h-[80vh] overflow-auto shadow-2xl">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-full bg-gradient-to-br from-yellow-400 to-orange-500 flex items-center justify-center">
                <Bot size={20} className="text-white" />
              </div>
              <div>
                <h3 className="font-semibold">Анализ ERIC</h3>
                <p className="text-sm text-gray-500">Рабочий документ</p>
              </div>
              <button
                onClick={() => setShowAnalysisModal(false)}
                className="ml-auto p-2 hover:bg-gray-100 rounded-full"
              >
                <X size={20} className="text-gray-500" />
              </button>
            </div>

            <div className="bg-gray-50 rounded-xl p-4 mb-4 text-sm leading-relaxed whitespace-pre-wrap">
              {ericAnalysis.analysis}
            </div>

            <div className="flex gap-3">
              <button
                onClick={copyAnalysis}
                className="flex-1 flex items-center justify-center gap-2 py-3 px-4 border border-gray-200 rounded-xl hover:bg-gray-50 font-medium"
              >
                {analysisCopied ? <Check size={18} className="text-green-500" /> : <Copy size={18} />}
                {analysisCopied ? 'Скопировано' : 'Копировать'}
              </button>
              <button
                onClick={addAnalysisToPost}
                className="flex-1 flex items-center justify-center gap-2 py-3 px-4 bg-gradient-to-r from-yellow-400 to-orange-500 text-white rounded-xl font-semibold"
              >
                <Sparkles size={18} />
                Добавить в пост
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default WorkPostComposer;
