import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import styled from 'styled-components';

const RegisterScreen = () => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [pending, setPending] = useState(false);
  const navigate = useNavigate();

  const handleRegister = async () => {
    if (pending) return;
    setError('');
    setPending(true);
    try {
      const response = await fetch('/api/auth/register', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ username, password }),
      });

      if (response.ok) {
        alert('Registration successful! Please log in.');
        navigate('/login');
      } else {
        const errorData = await response.json().catch(() => null);
        setError(errorData?.error || 'Failed to register');
      }
    } catch (err) {
      setError('Unable to connect to the server. Please try again.');
    } finally {
      setPending(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleRegister();
    }
  };

  return (
    <AuthContainer>
      <AuthCard>
        <Header>Join the Pantheon</Header>
        <InputField
          type="text"
          placeholder="New Hero's Name"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          onKeyDown={handleKeyDown}
        />
        <InputField
          type="password"
          placeholder="Choose a Secret Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          onKeyDown={handleKeyDown}
        />
        {error && <ErrorText>{error}</ErrorText>}
        <AuthButton onClick={handleRegister} disabled={pending}>
          {pending ? 'Forging...' : 'Forge Identity'}
        </AuthButton>
        <AuthLink to="/login">Already a God?</AuthLink>
      </AuthCard>
    </AuthContainer>
  );
};

const AuthContainer = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 20px;
  background-image: url('/images/background.jpeg');
  background-size: cover;
  background-position: center;
  min-height: 100vh;
  color: #fff;
`;

const AuthCard = styled.div`
  background-color: rgba(0, 0, 0, 0.7);
  border-radius: 15px;
  box-shadow: 0 5px 20px rgba(0, 0, 0, 0.7);
  padding: 40px;
  width: 90%;
  max-width: 400px;
  text-align: center;
  border: 2px solid #ffd700; /* Gold border */
`;

const Header = styled.h1`
  font-family: 'Georgia', serif;
  color: #ffd700; /* Gold */
  margin-bottom: 30px;
  font-size: 2.5em;
`;

const InputField = styled.input`
  width: calc(100% - 20px);
  padding: 12px 10px;
  margin-bottom: 15px;
  border: 1px solid #ddd;
  border-radius: 8px;
  background-color: rgba(255, 255, 255, 0.9);
  color: #333;
  font-size: 1.1em;
  &:focus {
    border-color: #ffd700;
    box-shadow: 0 0 8px rgba(255, 215, 0, 0.5);
    outline: none;
  }
`;

const ErrorText = styled.p`
  color: #ff6b6b;
  font-size: 0.95em;
  margin-bottom: 10px;
`;

const AuthButton = styled.button`
  background-color: #a0522d; /* Sienna */
  color: #f5f5dc; /* Beige */
  padding: 15px 25px;
  border: 2px solid #8b4513;
  border-radius: 8px;
  font-family: 'Cinzel Decorative', cursive;
  font-size: 1.2em;
  font-weight: bold;
  cursor: pointer;
  transition: background-color 0.3s ease, transform 0.2s ease, box-shadow 0.3s ease;
  &:hover {
    background-color: #8b4513;
    transform: translateY(-2px);
    box-shadow: 0 5px 15px rgba(0, 0, 0, 0.4);
  }
  &:disabled {
    cursor: not-allowed;
    opacity: 0.6;
  }
`;

const AuthLink = styled(Link)`
  display: block;
  margin-top: 20px;
  color: #add8e6; /* LightBlue */
  text-decoration: none;
  font-size: 1em;
  &:hover {
    text-decoration: underline;
  }
`;

export default RegisterScreen;
