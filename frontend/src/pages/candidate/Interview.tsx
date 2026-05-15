import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

// Redirect old interview route to new pre-check flow
export default function InterviewRoom() {
  const navigate = useNavigate();
  useEffect(() => {
    navigate('/pre-check', { replace: true });
  }, [navigate]);
  return null;
}
