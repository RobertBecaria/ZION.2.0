import React, { useState } from 'react';
import { User, Clock, ThumbsUp, ThumbsDown, CheckCircle } from 'lucide-react';
import { toast } from '../utils/animations';

const JoinRequestCard = ({ request, onVoteSubmitted }) => {
  const [voting, setVoting] = useState(false);
  const [voted, setVoted] = useState(false);

  const handleVote = async (voteChoice) => {
    setVoting(true);
    try {
      const token = localStorage.getItem('zion_token');
      const response = await fetch(
        `${process.env.REACT_APP_BACKEND_URL}/api/family-join-requests/${request.id}/vote`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify({ vote: voteChoice })
        }
      );

      if (response.ok) {
        const data = await response.json();
        setVoted(true);
        toast.success(data.message);
        onVoteSubmitted();
      } else {
        const errorData = await response.json();
        toast.error(errorData.detail || 'Ошибка при голосовании');
      }
    } catch (err) {
      toast.error('Ошибка при голосовании');
    } finally {
      setVoting(false);
    }
  };

  const approveVotes = request.votes?.filter(v => v.vote === 'APPROVE').length || 0;
  const rejectVotes = request.votes?.filter(v => v.vote === 'REJECT').length || 0;
  const totalVotes = request.votes?.length || 0;

  return (
    <div className="join-request-card">
      <div className="request-header">
        <div className="request-user">
          <User size={40} />
          <div>
            <h4>{request.requesting_user_name || 'Неизвестный пользователь'}</h4>
            <span className="request-time">
              <Clock size={14} />
              {new Date(request.created_at).toLocaleDateString('ru-RU')}
            </span>
          </div>
        </div>
      </div>

      {request.message && (
        <div className="request-message">
          <p>{request.message}</p>
        </div>
      )}

      <div className="voting-progress">
        <div className="vote-counts">
          <span className="approve-count">
            <ThumbsUp size={16} /> {approveVotes}
          </span>
          <span className="reject-count">
            <ThumbsDown size={16} /> {rejectVotes}
          </span>
        </div>
        <div className="vote-info">
          {totalVotes} из {request.total_voters} проголосовали
          (нужно {request.votes_required} для одобрения)
        </div>
      </div>

      {!voted && (
        <div className="voting-actions">
          <button
            onClick={() => handleVote('APPROVE')}
            disabled={voting}
            className="btn-vote btn-approve"
          >
            <ThumbsUp size={18} />
            Одобрить
          </button>
          <button
            onClick={() => handleVote('REJECT')}
            disabled={voting}
            className="btn-vote btn-reject"
          >
            <ThumbsDown size={18} />
            Отклонить
          </button>
        </div>
      )}

      {voted && (
        <div className="voted-message">
          <CheckCircle size={18} color="#059669" />
          <span>Вы проголосовали</span>
        </div>
      )}
    </div>
  );
};

export default JoinRequestCard;