import React from 'react';
import './CenteredLoader.css';

export default function CenteredLoader({ fullHeight = false, text = '' }) {
  return (
    <div className={`centered-loader-wrapper ${fullHeight ? 'full-height' : ''}`}>
      <div className="centered-loading-spinner" />
      {text && <p className="centered-loader-text">{text}</p>}
    </div>
  );
}
