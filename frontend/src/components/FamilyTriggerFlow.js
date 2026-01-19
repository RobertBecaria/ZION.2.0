import React, { useState, useEffect } from 'react';
import { Users, Home, Search, Plus } from 'lucide-react';
import MatchingFamiliesDisplay from './MatchingFamiliesDisplay';
import FamilyUnitCreation from './FamilyUnitCreation';
import FamilyUnitDashboard from './FamilyUnitDashboard';
import { toast } from '../utils/animations';

const FamilyTriggerFlow = ({ user, onUpdateUser }) => {
  const [step, setStep] = useState('loading'); // loading, checking, matches, create, dashboard
  const [matches, setMatches] = useState([]);
  const [selectedFamily, setSelectedFamily] = useState(null);
  const [userFamilyUnits, setUserFamilyUnits] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    checkUserFamilyStatus();
  }, []);

  const checkUserFamilyStatus = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('zion_token');
      
      if (!token) {
        console.error('No auth token found');
        setError('Ошибка авторизации');
        setStep('create');
        setLoading(false);
        return;
      }
      
      // First, check if user already has family units
      const myUnitsResponse = await fetch(
        `${process.env.REACT_APP_BACKEND_URL}/api/family-units/my-units`,
        {
          headers: { 'Authorization': `Bearer ${token}` }
        }
      );

      if (myUnitsResponse.ok) {
        const data = await myUnitsResponse.json();
        
        // Validate data structure
        if (data && data.family_units && Array.isArray(data.family_units) && data.family_units.length > 0) {
          // Filter valid family units only
          const validUnits = data.family_units.filter(unit => 
            unit && unit.id && unit.family_name && unit.family_surname
          );
          
          if (validUnits.length > 0) {
            setUserFamilyUnits(validUnits);
            setSelectedFamily(validUnits[0]);
            setStep('dashboard');
            setLoading(false);
            return;
          }
        }
      } else if (myUnitsResponse.status === 400) {
        // Profile not completed - this is expected
        const errorData = await myUnitsResponse.json().catch(() => ({}));
        if (errorData.detail && errorData.detail.includes('profile')) {
          setError('Пожалуйста, завершите профиль');
          setStep('create');
          setLoading(false);
          return;
        }
      }

      // If no family units, check for matches
      const matchResponse = await fetch(
        `${process.env.REACT_APP_BACKEND_URL}/api/family-units/check-match`,
        {
          headers: { 'Authorization': `Bearer ${token}` }
        }
      );

      if (matchResponse.ok) {
        const matchData = await matchResponse.json();
        if (matchData && matchData.matches_found && Array.isArray(matchData.matches) && matchData.matches.length > 0) {
          setMatches(matchData.matches);
          setStep('matches');
        } else {
          setStep('create');
        }
      } else if (matchResponse.status === 400) {
        // Profile not completed - show create form
        setStep('create');
      } else {
        setStep('create');
      }
    } catch (err) {
      console.error('Error checking family status:', err);
      setError('Ошибка при проверке семейного статуса');
      setStep('create');
    } finally {
      setLoading(false);
    }
  };

  const handleFamilyCreated = (newFamily) => {
    setUserFamilyUnits([newFamily]);
    setSelectedFamily(newFamily);
    setStep('dashboard');
  };

  const handleJoinRequest = async (familyUnitId) => {
    try {
      const token = localStorage.getItem('zion_token');
      const response = await fetch(
        `${process.env.REACT_APP_BACKEND_URL}/api/family-units/${familyUnitId}/join-request`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify({
            message: 'Хочу присоединиться к вашей семье'
          })
        }
      );

      if (response.ok) {
        toast.success('Запрос на присоединение отправлен! Ожидайте одобрения от глав семьи.');
        setStep('create'); // Show create option while waiting
      } else {
        throw new Error('Не удалось отправить запрос');
      }
    } catch (err) {
      setError(err.message);
    }
  };

  const handleSelectFamily = (family) => {
    setSelectedFamily(family);
    setStep('dashboard');
  };

  if (loading) {
    return (
      <div className="family-trigger-loading">
        <div className="loading-spinner"></div>
        <p>Проверка семейного статуса...</p>
      </div>
    );
  }

  if (step === 'matches') {
    return (
      <MatchingFamiliesDisplay
        matches={matches}
        onJoinRequest={handleJoinRequest}
        onCreateNew={() => setStep('create')}
      />
    );
  }

  if (step === 'create') {
    return (
      <FamilyUnitCreation
        user={user}
        onFamilyCreated={handleFamilyCreated}
        onCancel={() => setStep('checking')}
      />
    );
  }

  if (step === 'dashboard' && selectedFamily) {
    return (
      <FamilyUnitDashboard
        familyUnit={selectedFamily}
        user={user}
        allFamilyUnits={userFamilyUnits}
        onSelectFamily={handleSelectFamily}
        onRefresh={checkUserFamilyStatus}
      />
    );
  }

  return (
    <div className="family-trigger-error">
      <p>{error || 'Произошла ошибка'}</p>
      <button onClick={checkUserFamilyStatus} className="btn-primary">
        Попробовать снова
      </button>
    </div>
  );
};

export default FamilyTriggerFlow;