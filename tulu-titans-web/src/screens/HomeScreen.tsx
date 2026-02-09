import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import styled from 'styled-components';

interface UserStats {
  username: string;
  level: number;
  experience: number;
  currency: number;
}

const HomeScreen = () => {
  const [userStats, setUserStats] = useState<UserStats | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const navigate = useNavigate();

  useEffect(() => {
    const fetchUserStats = async () => {
      const token = localStorage.getItem('token');
      if (!token) {
        navigate('/login');
        return;
      }

      try {
        const response = await fetch('/api/game/me', {
          headers: {
            'Authorization': `Bearer ${token}`,
          } as HeadersInit,
        });

        if (response.ok) {
          const data: UserStats = await response.json();
          setUserStats(data);
        } else {
          // If token is invalid or expired, redirect to login
          localStorage.removeItem('token');
          navigate('/login');
        }
      } catch (error) {
        console.error('Error fetching user stats:', error);
        localStorage.removeItem('token');
        navigate('/login');
      } finally {
        setLoading(false);
      }
    };

    fetchUserStats();
  }, [navigate]);

  const handleLogout = () => {
    localStorage.removeItem('token');
    navigate('/login');
  };

  if (loading) {
    return <HomeContainer>Loading user data...</HomeContainer>;
  }

  if (!userStats) {
    return <HomeContainer>Please log in to view your home screen.</HomeContainer>;
  }

  const isAscended = userStats.level > 5;

  return (
    <HomeContainer>
      {isAscended ? (
        <Header>Hail, {userStats.username}, God of Tulu Wisdom!</Header>
      ) : (
        <Header>Welcome, {userStats.username} of Olympus!</Header>
      )}
      <UserStatsCard>
        <StatItem>Level: {userStats.level}{isAscended ? ' (Divine)' : ''}</StatItem>
        <StatItem>XP: {userStats.experience}</StatItem>
        <StatItem>Coins: {userStats.currency}</StatItem>
      </UserStatsCard>
      <NavigationList>
        <NavigationItem>
          <NavLink to="/combat">{isAscended ? 'Continue Your Divine Quest' : 'Embark on a Quest'}</NavLink>
        </NavigationItem>
        {isAscended && (
          <NavigationItem>
            <NavLink to="/ascension">Relive Your Ascension</NavLink>
          </NavigationItem>
        )}
        <NavigationItem>
          <LogoutButton onClick={handleLogout}>Leave Olympus</LogoutButton>
        </NavigationItem>
      </NavigationList>
    </HomeContainer>
  );
};

const HomeContainer = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 20px;
  background-image: url('/images/background.jpeg');
  background-size: cover;
  background-position: center;
  min-height: 100vh;
  color: #fff; /* White text for contrast */
  text-shadow: 2px 2px 4px rgba(0, 0, 0, 0.7);
`;

const Header = styled.h1`
  font-family: 'Georgia', serif; /* A more classic font */
  color: #ffd700; /* Gold color */
  margin-bottom: 30px;
  font-size: 2.8em;
  text-transform: uppercase;
  letter-spacing: 2px;
`;

const UserStatsCard = styled.div`
  background-color: rgba(0, 0, 0, 0.6); /* Semi-transparent background */
  border-radius: 15px;
  box-shadow: 0 5px 15px rgba(0, 0, 0, 0.5);
  padding: 25px;
  width: 70%;
  max-width: 500px;
  text-align: center;
  margin-bottom: 40px;
  border: 2px solid #ffd700; /* Gold border */
`;

const StatItem = styled.p`
  font-family: 'Verdana', sans-serif;
  font-size: 1.3em;
  font-weight: bold;
  color: #f0f8ff; /* AliceBlue */
  margin: 10px 0;
`;

const NavigationList = styled.ul`
  list-style: none;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 20px;
`;

const NavigationItem = styled.li`
  width: 100%;
  text-align: center;
`;

const NavLink = styled(Link)`
  display: block;
  background-color: #a0522d; /* Sienna - earthy tone */
  color: #f5f5dc; /* Beige - parchment like */
  padding: 15px 30px;
  border-radius: 8px;
  text-decoration: none;
  font-family: 'Cinzel Decorative', cursive; /* Assuming a Google Font or similar is used */
  font-size: 1.3em;
  font-weight: bold;
  letter-spacing: 1px;
  transition: background-color 0.3s ease, transform 0.2s ease, box-shadow 0.3s ease;
  border: 2px solid #8b4513; /* SaddleBrown */
  &:hover {
    background-color: #8b4513; /* SaddleBrown - darker on hover */
    transform: translateY(-3px);
    box-shadow: 0 8px 15px rgba(0, 0, 0, 0.4);
  }
`;

const LogoutButton = styled.button`
  display: block;
  width: 100%;
  background-color: #a0522d;
  color: #f5f5dc;
  padding: 15px 30px;
  border-radius: 8px;
  font-family: 'Cinzel Decorative', cursive;
  font-size: 1.3em;
  font-weight: bold;
  letter-spacing: 1px;
  cursor: pointer;
  transition: background-color 0.3s ease, transform 0.2s ease, box-shadow 0.3s ease;
  border: 2px solid #8b4513;
  &:hover {
    background-color: #8b4513;
    transform: translateY(-3px);
    box-shadow: 0 8px 15px rgba(0, 0, 0, 0.4);
  }
`;

export default HomeScreen;
