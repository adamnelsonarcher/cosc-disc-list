import { useState, useEffect } from 'react';
import './App.css';

function App() {
  const [courses, setCourses] = useState([]);
  const [expandedCourses, setExpandedCourses] = useState({});

  // Helper function to process in batches with retries
  const processBatch = async (items, batchSize = 2) => {
    const results = [];
    for (let i = 0; i < items.length; i += batchSize) {
      const batch = items.slice(i, i + batchSize);
      const batchResults = await Promise.all(
        batch.map(async item => {
          // Try up to 3 times
          for (let attempt = 1; attempt <= 3; attempt++) {
            try {
              return await item();
            } catch (error) {
              if (attempt === 3) throw error;
              // Wait longer between retries
              await new Promise(resolve => setTimeout(resolve, 1000 * attempt));
            }
          }
        })
      );
      results.push(...batchResults);
      // Increased delay between batches
      if (i + batchSize < items.length) {
        await new Promise(resolve => setTimeout(resolve, 500));
      }
    }
    return results;
  };

  const fetchDiscordMetadata = async (link, courseIndex, profIndex) => {
    try {
      const inviteCode = link.split('/').pop();
      
      // First try to get from static metadata
      const staticMetadata = await fetch('/server-metadata.json')
        .then(res => res.json())
        .catch(() => ({}));
      
      if (staticMetadata[inviteCode]) {
        // Use static data if available
        setCourses(prevCourses => {
          const newCourses = [...prevCourses];
          if (newCourses[courseIndex]?.professors[profIndex]) {
            newCourses[courseIndex].professors[profIndex] = {
              ...newCourses[courseIndex].professors[profIndex],
              serverName: staticMetadata[inviteCode].name,
              serverIcon: staticMetadata[inviteCode].icon
            };
          }
          return newCourses;
        });
        return;
      }

      // If no static data, fall back to Discord API
      console.log(`No static data for ${inviteCode}, fetching from Discord...`);
      const response = await fetch(`/api/discord-invite/${inviteCode}`);
      
      if (!response.ok) {
        throw new Error(`API error: ${response.statusText}`);
      }
      
      const data = await response.json();
      
      if (!data.guild) {
        throw new Error('No guild information found for this invite.');
      }

      // Log the data in the format matching servers.json
      console.log(`Add this to server-metadata.json for ${inviteCode}:`, {
        [inviteCode]: {
          name: data.guild.name,
          icon: data.guild.icon 
            ? `https://cdn.discordapp.com/icons/${data.guild.id}/${data.guild.icon}.${data.guild.icon.startsWith('a_') ? 'gif' : 'png'}?size=1024`
            : 'https://discord.com/assets/847541504914fd33810e70a0ea73177e.ico'
        }
      });

      setCourses(prevCourses => {
        const newCourses = [...prevCourses];
        if (newCourses[courseIndex]?.professors[profIndex]) {
          newCourses[courseIndex].professors[profIndex] = {
            ...newCourses[courseIndex].professors[profIndex],
            serverName: data.guild.name || 'Discord Server',
            serverIcon: data.guild.icon 
              ? `https://cdn.discordapp.com/icons/${data.guild.id}/${data.guild.icon}.${data.guild.icon.startsWith('a_') ? 'gif' : 'png'}?size=1024`
              : 'https://discord.com/assets/847541504914fd33810e70a0ea73177e.ico'
          };
        }
        return newCourses;
      });
    } catch (error) {
      console.error('Error fetching Discord metadata:', error);
      setCourses(prevCourses => {
        const newCourses = [...prevCourses];
        if (newCourses[courseIndex]?.professors[profIndex]) {
          newCourses[courseIndex].professors[profIndex] = {
            ...newCourses[courseIndex].professors[profIndex],
            serverName: 'Unable to load server info',
            serverIcon: 'https://discord.com/assets/847541504914fd33810e70a0ea73177e.ico'
          };
        }
        return newCourses;
      });
    }
  };

  const getCourseStats = (courses) => {
    const totalCourses = courses.length;
    const coursesWithDiscord = courses.filter(course => course.professors.length > 0).length;
    return { totalCourses, coursesWithDiscord };
  };

  useEffect(() => {
    // Load courses from servers.json
    fetch('/servers.json')
      .then(response => response.json())
      .then(async (courses) => {
        // Add formatted display names before setting state
        const coursesWithFormatting = courses.map(course => ({
          ...course,
          displayName: `COSC ${course.courseId} - ${course.courseName}`
        }));
        
        setCourses(coursesWithFormatting);

        // Create array of fetch functions for servers without static data
        const fetchFunctions = [];
        coursesWithFormatting.forEach((course, courseIndex) => {
          course.professors?.forEach((prof, profIndex) => {
            if (prof.link && !prof.isDM) {
              fetchFunctions.push(() => fetchDiscordMetadata(prof.link, courseIndex, profIndex));
            }
          });
        });

        // Process fetches in batches with retries
        await processBatch(fetchFunctions, 2);
      })
      .catch(error => console.error('Error loading server list:', error));
  }, []);

  const toggleCourse = (courseId) => {
    setExpandedCourses(prev => ({
      ...prev,
      [courseId]: !prev[courseId]
    }));
  };

  return (
    <div className="App">
      <header className="App-header">
        <div className="header-content">
          <h1>UH Computer Science Discord Links</h1>
          <div className="header-info">
            <p className="subtitle">Click on a professor's card to join their Discord server</p>
            <p className="stats">
              {getCourseStats(courses).coursesWithDiscord}/{getCourseStats(courses).totalCourses} courses have Discord servers
            </p>
          </div>
        </div>
        
        <div className="discord-links">
          {courses.map((course, courseIndex) => (
            <div 
              key={courseIndex} 
              className={`course-card ${course.professors.length === 0 ? 'empty-course' : 'has-links'} ${expandedCourses[course.courseId] ? 'expanded' : ''}`}
              onClick={() => course.professors.length > 0 && toggleCourse(course.courseId)}
            >
              <div className="course-header">
                <span className="course-id">COSC {course.courseId}</span>
                <span className="course-name">{course.courseName}</span>
                <div className="course-info">
                  <span className={`server-count ${course.professors.length === 0 ? 'empty' : ''}`}>
                    {course.professors.length}
                  </span>
                  {course.professors.length > 0 && (
                    <span className="expand-icon">{expandedCourses[course.courseId] ? '▼' : '▶'}</span>
                  )}
                </div>
              </div>
              {course.professors.length > 0 && expandedCourses[course.courseId] && (
                <div className="professor-grid">
                  {course.professors.map((prof, profIndex) => (
                    prof.isDM ? (
                      <div key={profIndex} className="professor-card dm-card">
                        <span className="prof-name">{prof.name}</span>
                      </div>
                    ) : (
                      <a 
                        key={profIndex}
                        href={prof.link}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="professor-card"
                      >
                        <div className={`server-icon ${!prof.serverIcon || prof.serverIcon.includes('847541504914fd33810e70a0ea73177e') ? 'loading' : ''}`}>
                          {prof.serverIcon && !prof.serverIcon.includes('847541504914fd33810e70a0ea73177e') && (
                            <img src={prof.serverIcon} alt="Server Icon" />
                          )}
                        </div>
                        <span className="prof-name">{prof.name}</span>
                        {prof.serverName && prof.serverName !== 'Unable to load server info' && (
                          <span className="server-name">{prof.serverName}</span>
                        )}
                        <span className="join-text">{prof.link}</span>
                      </a>
                    )
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      </header>
    </div>
  );
}

export default App;
