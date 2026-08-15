/*
    Custom profile -> Choose Emoji
    Used by workspaceMenu.js
*/
export const themeEmojiSets = {
    emojis: [
        { emoji: '😀', label: 'Grinning face' },
        { emoji: '😁', label: 'Beaming face' },
        { emoji: '😂', label: 'Joy face' },
        { emoji: '🤣', label: 'Laughing face' },
        { emoji: '😊', label: 'Smiling face' },
        { emoji: '😍', label: 'Smiling face' },
        { emoji: '😎', label: 'Another Smiling face' },
        { emoji: '🤔', label: 'Thinking face' },
        { emoji: '😴', label: 'Sleeping face' },
        { emoji: '🥳', label: 'Partying face' },
        { emoji: '🐶', label: 'Dog face' },
        { emoji: '🐱', label: 'Cat face' },
        { emoji: '🦊', label: 'Fox' },
        { emoji: '🐼', label: 'Panda' },
        { emoji: '🐸', label: 'Frog' },
        { emoji: '🍕', label: 'Pizza' },
        { emoji: '⚽', label: 'Soccer ball' },
        { emoji: '🎨', label: 'Artist palette' },
        { emoji: '🚀', label: 'Rocket' },
        { emoji: '🌟', label: 'Glowing star' },
    ],
};

export const renderProfileEmojiOptions = () => {
    return themeEmojiSets.emojis.map(
        (
            {
                emoji,
                label
            }
        ) => `<button type="button" class="collab-share-emoji-option" data-emoji="${emoji}" role="option" aria-selected="false" aria-label="${label}">${emoji}</button>`
    ).join('');
};