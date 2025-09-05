import React from 'react';

import './SkillBadge.css';

const SkillBadge = ({skill}) => { 
        return (
            <div className='skill-badge'>
            <p className='skill-text'>
                Skill: {skill}
            </p>
        </div>
        );
    };

export default SkillBadge;