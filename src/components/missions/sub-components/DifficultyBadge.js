import React from 'react';

import './DifficultyBadge.css';


const DifficultyBadge = ({difficulty}) => { 
    switch (difficulty) {
        case 'easy': return (
            <div className="difficulty-badge easy">
                <svg className="star" xmlns="http://www.w3.org/2000/svg" height="24px" viewBox="0 -960 960 960" width="24px">
                    <path d="m233-120 65-281L80-590l288-25 112-265 112 265 288 25-218 189 65 281-247-149-247 149Z" />
                </svg>
                <span className="difficulty-rating">Easy</span>
            </div>
        );
        case 'medium': return (
            <div className="difficulty-badge medium">
                <svg className="star" xmlns="http://www.w3.org/2000/svg" height="24px" viewBox="0 -960 960 960" width="24px">
                    <path d="m233-120 65-281L80-590l288-25 112-265 112 265 288 25-218 189 65 281-247-149-247 149Z" />
                </svg>
                <svg className="star" xmlns="http://www.w3.org/2000/svg" height="24px" viewBox="0 -960 960 960" width="24px">
                    <path d="m233-120 65-281L80-590l288-25 112-265 112 265 288 25-218 189 65 281-247-149-247 149Z" />
                </svg>
                <span className="difficulty-rating">Medium</span>
            </div>
        );
        case 'hard': return (
            <div className="difficulty-badge hard">
                <svg className="star" xmlns="http://www.w3.org/2000/svg" height="24px" viewBox="0 -960 960 960" width="24px">
                <path d="m233-120 65-281L80-590l288-25 112-265 112 265 288 25-218 189 65 281-247-149-247 149Z" />
                </svg>
                <svg className="star" xmlns="http://www.w3.org/2000/svg" height="24px" viewBox="0 -960 960 960" width="24px">
                    <path d="m233-120 65-281L80-590l288-25 112-265 112 265 288 25-218 189 65 281-247-149-247 149Z" />
                </svg>
                <svg className="star" xmlns="http://www.w3.org/2000/svg" height="24px" viewBox="0 -960 960 960" width="24px">
                    <path d="m233-120 65-281L80-590l288-25 112-265 112 265 288 25-218 189 65 281-247-149-247 149Z" />
                </svg>
                <span className="difficulty-rating">Hard</span>
            </div>
        );
        default: return (
            <div className="difficulty-badge easy">
                <svg className="star" xmlns="http://www.w3.org/2000/svg" height="24px" viewBox="0 -960 960 960" width="24px">
                    <path d="m233-120 65-281L80-590l288-25 112-265 112 265 288 25-218 189 65 281-247-149-247 149Z" />
                </svg>
                <span className="difficulty-rating">Easy</span>
            </div>
        );
    }
};

export default DifficultyBadge;