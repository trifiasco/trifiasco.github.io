import React from 'react';
// import './modal.scss'

const Modal = (props) => {
    const onClose = event => {
        props.onClose(event);
    };

    return (
        <div class="modal" id="modal">
            <div class="content">{props.children}</div>
            <div class="actions">
                <button class="toggle-button" onClick={onClose}>Close</button>
            </div>
        </div>
    );
};
export default Modal;