/**
 * ERIC Contextual Analyzer Button
 * Add to any upload flow to enable contextual analysis with ERIC
 */
import React, { useState } from 'react';
import { Sparkles, Loader2 } from 'lucide-react';

const ERICAnalyzeButton = ({ 
  file,          // File object or URL to analyze
  context,       // Context type: 'work', 'family', 'finance', 'calendar', 'marketplace'
  contextData,   // Additional context data (e.g., organization info, event details)
  onAnalysisStart,
  onAnalysisComplete,
  onError,
  variant = 'default',  // 'default', 'compact', 'icon-only'
  disabled = false
}) => {
  const [analyzing, setAnalyzing] = useState(false);
  const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;

  const contextLabels = {
    work: 'Рабочий документ',
    family: 'Семейное фото',
    finance: 'Финансовый документ',
    calendar: 'Событие календаря',
    marketplace: 'Товар маркетплейса',
    generic: 'Файл'
  };

  const handleAnalyze = async () => {
    if (analyzing || disabled || !file) return;
    
    setAnalyzing(true);
    onAnalysisStart?.();
    
    try {
      const token = localStorage.getItem('zion_token');
      const formData = new FormData();
      
      // Add file
      if (file instanceof File) {
        formData.append('file', file);
      } else if (typeof file === 'string') {
        formData.append('file_url', file);
      }
      
      // Add context
      formData.append('context_type', context || 'generic');
      formData.append('context_data', JSON.stringify(contextData || {}));
      
      // Build analysis prompt based on context
      let analysisPrompt = '';
      switch (context) {
        case 'work':
          analysisPrompt = `Проанализируй этот рабочий документ. Контекст: ${contextData?.organizationName || 'организация'}. Определи тип документа, ключевую информацию и возможные действия.`;
          break;
        case 'family':
          analysisPrompt = 'Проанализируй это семейное фото. Определи событие, людей на фото и предложи теги для организации.';
          break;
        case 'finance':
          analysisPrompt = 'Проанализируй этот финансовый документ. Определи тип (чек, счёт, договор), сумму и важные детали.';
          break;
        case 'calendar':
          analysisPrompt = `Проанализируй информацию о событии: ${contextData?.eventTitle || 'событие'}. Предложи подготовку и напоминания.`;
          break;
        case 'marketplace':
          analysisPrompt = 'Проанализируй этот товар. Определи категорию, состояние и предложи оптимальную цену.';
          break;
        default:
          analysisPrompt = 'Проанализируй этот файл и определи его содержимое и назначение.';
      }
      formData.append('message', analysisPrompt);
      
      // Determine which endpoint to use based on file type
      const isImage = file instanceof File && file.type?.startsWith('image/');
      const endpoint = isImage ? '/api/agent/analyze-image' : '/api/agent/analyze-document';
      
      const response = await fetch(`${BACKEND_URL}${endpoint}`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`
        },
        body: formData
      });
      
      if (response.ok) {
        const result = await response.json();
        onAnalysisComplete?.({
          success: true,
          analysis: result.analysis || result.message?.content,
          context: context,
          contextData: contextData
        });
      } else {
        const error = await response.json();
        throw new Error(error.detail || 'Analysis failed');
      }
    } catch (err) {
      console.error('ERIC analysis error:', err);
      onError?.(err.message || 'Ошибка анализа');
    } finally {
      setAnalyzing(false);
    }
  };

  if (variant === 'icon-only') {
    return (
      <button
        onClick={handleAnalyze}
        disabled={analyzing || disabled}
        className="eric-analyze-icon-btn"
        title={`Анализ с ERIC: ${contextLabels[context] || contextLabels.generic}`}
        style={{
          width: 36,
          height: 36,
          borderRadius: '50%',
          background: analyzing ? '#f3f4f6' : 'linear-gradient(135deg, #FFD93D 0%, #FF9500 100%)',
          border: 'none',
          cursor: disabled ? 'not-allowed' : 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: analyzing ? '#9ca3af' : 'white',
          boxShadow: '0 2px 8px rgba(255, 149, 0, 0.3)',
          transition: 'all 0.2s'
        }}
      >
        {analyzing ? <Loader2 size={18} className="animate-spin" /> : <Sparkles size={18} />}
      </button>
    );
  }

  if (variant === 'compact') {
    return (
      <button
        onClick={handleAnalyze}
        disabled={analyzing || disabled}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          padding: '6px 12px',
          borderRadius: 8,
          background: analyzing ? '#f3f4f6' : 'linear-gradient(135deg, #FFD93D 0%, #FF9500 100%)',
          border: 'none',
          cursor: disabled ? 'not-allowed' : 'pointer',
          color: analyzing ? '#6b7280' : 'white',
          fontSize: 13,
          fontWeight: 500,
          transition: 'all 0.2s'
        }}
      >
        {analyzing ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />}
        {analyzing ? 'Анализ...' : 'ERIC'}
      </button>
    );
  }

  return (
    <button
      onClick={handleAnalyze}
      disabled={analyzing || disabled}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        padding: '10px 16px',
        borderRadius: 10,
        background: analyzing ? '#f3f4f6' : 'linear-gradient(135deg, #FFD93D 0%, #FF9500 100%)',
        border: 'none',
        cursor: disabled ? 'not-allowed' : 'pointer',
        color: analyzing ? '#6b7280' : 'white',
        fontSize: 14,
        fontWeight: 600,
        boxShadow: analyzing ? 'none' : '0 4px 12px rgba(255, 149, 0, 0.3)',
        transition: 'all 0.2s'
      }}
    >
      {analyzing ? <Loader2 size={18} className="animate-spin" /> : <Sparkles size={18} />}
      {analyzing ? 'Анализирую...' : 'Спросить ERIC'}
      {!analyzing && (
        <span style={{
          fontSize: 11,
          opacity: 0.9,
          marginLeft: 4
        }}>
          ({contextLabels[context] || contextLabels.generic})
        </span>
      )}
    </button>
  );
};

export default ERICAnalyzeButton;
