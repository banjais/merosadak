import React, { useState, useRef } from 'react';

const ExpandableCard = ({ children, fixedHeight = '300px', expandedHeight = 'auto' }) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const contentRef = useRef(null);

  const handleToggle = () => {
    setIsExpanded(!isExpanded);
  };

  const cardStyle = {
    position: 'relative',
    height: isExpanded ? expandedHeight : fixedHeight,
    overflowY: isExpanded ? 'auto' : 'hidden',
    transition: 'height 0.3s ease',
  };

  const toggleButtonStyle = {
    position: 'absolute',
    bottom: '8px',
    right: '8px',
    background: '#fff',
    border: '1px solid #ccc',
    borderRadius: '4px',
    padding: '6px 12px',
    cursor: 'pointer',
    fontSize: '12px',
    boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
    zIndex: 10,
  };

  return (
    <div style={cardStyle} ref={contentRef}>
      {children}
      <button style={toggleButtonStyle} onClick={handleToggle}>
        {isExpanded ? '▼ Collapse' : '▲ Expand'}
      </button>
    </div>
  );
};

export default ExpandableCard;