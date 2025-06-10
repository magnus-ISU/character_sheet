<script lang="ts">
	import { onMount, onDestroy } from 'svelte';

	// Props with defaults
	let {
		value = $bindable(''),
		placeholder = 'Enter your text here...',
		storageKey = 'persistent-textarea',
		storagePrefix = 'svelte-persistent-',
		class: className = '',
		...restProps
	} = $props();

	// Create full storage key with prefix
	const fullStorageKey = storagePrefix + storageKey;
	const tokenStorageKey = 'svelte-persistent-dropbox-token';

	let lastValue = $state(value);
	let isLoaded = $state(false);

	let hasLoadedRemoteValue = $state(false);
	let dbx = $state(null);
	let accessToken = $state('');
	let saveTimeout: number | null = $state(null);
	let lastSyncTime: Date | null = $state(null);
	let syncStatus = $state(
		"Not connected - visit https://www.dropbox.com/developers/apps/ and paste your app's access token"
	);
	let showDropboxControls = $derived(accessToken === '');
	let isDebouncing = $derived(saveTimeout !== null);

	// Long polling state
	let longPollController: AbortController | null = $state(null);
	let cursor = $state(null);
	let isLongPolling = $state(false);

	// User activity tracking
	let lastUserActivity = $state(Date.now());
	let isUserTyping = $state(false);
	let typingTimeout: number | null = $state(null);

	// Track last content sent to Dropbox to avoid processing our own updates
	let lastSentToDropbox = $state('');

	// Dropbox file path based on storage key
	const dropboxPath = `/${fullStorageKey}`;

	function updateValue(newValue: string) {
		value = newValue;
		lastValue = newValue;
	}

	// Track user typing activity
	function trackUserActivity() {
		lastUserActivity = Date.now();
		isUserTyping = true;

		// Clear existing timeout
		if (typingTimeout) {
			clearTimeout(typingTimeout);
		}

		// Consider user stopped typing after 2 seconds of inactivity
		typingTimeout = setTimeout(() => {
			isUserTyping = false;
		}, 2000);
	}

	// Load value from localStorage on mount (localStorage takes precedence)
	onMount(async () => {
		try {
			const saved = localStorage.getItem(fullStorageKey);
			if (saved !== null) {
				updateValue(saved);
			}
		} catch (error) {
			console.warn('Failed to load from localStorage:', error);
		}

		// Try to load saved access token
		try {
			const savedToken = localStorage.getItem(tokenStorageKey);
			if (savedToken) {
				accessToken = savedToken;
			}
		} catch (error) {
			console.warn('Failed to load access token from localStorage:', error);
		}

		// Try to load Dropbox SDK
		if (typeof window !== 'undefined' && !(window as any).Dropbox) {
			await loadDropboxSDK();
		}

		isLoaded = true;

		// Auto-connect if we have a saved token
		if (accessToken && !dbx) {
			connectToDropbox();
		}
	});

	// Clean up on destroy
	onDestroy(() => {
		if (saveTimeout) {
			clearTimeout(saveTimeout);
		}
		if (typingTimeout) {
			clearTimeout(typingTimeout);
		}
		if (longPollController) {
			longPollController.abort();
		}
	});

	// Load Dropbox SDK dynamically
	async function loadDropboxSDK() {
		return new Promise((resolve, reject) => {
			const script = document.createElement('script');
			script.src = 'https://cdnjs.cloudflare.com/ajax/libs/dropbox.js/10.34.0/Dropbox-sdk.min.js';
			script.onload = resolve;
			script.onerror = reject;
			document.head.appendChild(script);
		});
	}

	// Connect to Dropbox
	async function connectToDropbox() {
		if (!accessToken.trim()) {
			syncStatus = 'Please enter access token';
			return;
		}

		syncStatus = 'Connecting...';

		try {
			dbx = new (window as any).Dropbox.Dropbox({ accessToken: accessToken.trim() });

			// Test connection
			const response = await (dbx as any).usersGetCurrentAccount();
			syncStatus = `Connected as ${response.result.name.display_name}`;

			// Save token to localStorage
			try {
				localStorage.setItem(tokenStorageKey, accessToken.trim());
			} catch (error) {
				console.warn('Failed to save token to localStorage:', error);
			}

			// Load initial content from Dropbox and get cursor
			await initializeFromDropbox();

			// Start long polling for changes
			startLongPolling();
		} catch (error) {
			console.error('Dropbox connection failed:', error);
			syncStatus = 'Connection failed - clearing token';

			// Clear saved token on connection failure
			try {
				localStorage.removeItem(tokenStorageKey);
			} catch (e) {
				console.warn('Failed to clear token from localStorage:', e);
			}

			dbx = null;
			accessToken = '';

			// Clear the token after a short delay to show the error
			setTimeout(() => {
				syncStatus =
					"Not connected - visit https://www.dropbox.com/developers/apps/ and paste your app's access token";
			}, 3000);
		}
	}

	// Initialize from Dropbox and get initial cursor
	async function initializeFromDropbox() {
		if (!dbx) return;

		try {
			// First, try to get the folder cursor
			const folderResponse = await (dbx as any).filesListFolder({
				path: '',
				recursive: false,
				include_deleted: false
			});

			cursor = folderResponse.result.cursor;

			// Check if our file exists in the folder listing
			const ourFile = folderResponse.result.entries.find(
				(entry: any) => entry.path_lower === dropboxPath.toLowerCase()
			);

			if (ourFile) {
				// File exists, load its content
				await loadFromDropbox();
			} else {
				syncStatus = 'File not found in Dropbox, will create on next save';
				hasLoadedRemoteValue = true;
			}
		} catch (error: any) {
			console.error('Failed to initialize from Dropbox:', error);
			syncStatus = 'Initialization error';
		}
	}

	// Load content from Dropbox
	async function loadFromDropbox() {
		if (!dbx || isDebouncing) return;

		try {
			const response = await (dbx as any).filesDownload({ path: dropboxPath });
			const fileContent = await response.result.fileBlob.text();

			// Smart conflict resolution: only update if user isn't actively typing
			// or if this is the initial load
			if (!hasLoadedRemoteValue) {
				// Initial load - always update
				updateValue(fileContent);
				lastSentToDropbox = fileContent; // Track this as our baseline
				lastSyncTime = new Date();
				syncStatus = `Loaded from Dropbox (${lastSyncTime.toLocaleTimeString()})`;
				hasLoadedRemoteValue = true;
			} else if (fileContent !== value) {
				// Check if this is our own update that we sent to Dropbox
				if (fileContent === lastSentToDropbox) {
					// This is our own update echoing back - ignore it
					lastSyncTime = new Date();
					syncStatus = `Confirmed save (${lastSyncTime.toLocaleTimeString()})`;
					return;
				}

				// Content has genuinely changed from another source
				if (isUserTyping || Date.now() - lastUserActivity < 3000) {
					// User is actively typing or recently typed - don't interrupt
					syncStatus = `Remote changes detected (waiting for typing to finish)`;
				} else {
					// Safe to update - user isn't typing, and this is a real external change
					console.log('🔄 Textarea content overwritten by external update');
					console.log('📝 Previous local content:', value);
					console.log('📥 New external content:', fileContent);
					console.log('⚠️  If this was a mistake, copy the "Previous local content" above');

					updateValue(fileContent);
					lastSentToDropbox = fileContent; // Update our tracking
					lastSyncTime = new Date();
					syncStatus = `Updated from Dropbox (${lastSyncTime.toLocaleTimeString()})`;
				}
			} else {
				lastSyncTime = new Date();
				syncStatus = `No changes since (${lastSyncTime.toLocaleTimeString()})`;
			}
		} catch (error: any) {
			if (error.status === 409) {
				syncStatus = 'File not found in Dropbox, will create on next save';
				hasLoadedRemoteValue = true;
			} else {
				console.error('Failed to load from Dropbox:', error);
				syncStatus = 'Sync error (load)';
			}
		}
	}

	// Start long polling for changes
	async function startLongPolling() {
		if (!dbx || !cursor || isLongPolling) return;

		isLongPolling = true;

		while (dbx && cursor && isLongPolling) {
			try {
				// Abort previous controller if it exists
				if (longPollController) {
					longPollController.abort();
				}

				// Create new abort controller for this long poll request
				longPollController = new AbortController();

				// Long poll for changes (timeout after 30 seconds)
				const longPollResponse = await (dbx as any).filesListFolderLongpoll({
					cursor: cursor,
					timeout: 30
				});

				if (longPollResponse.result.changes) {
					// Changes detected, get the actual changes
					const changesResponse = await (dbx as any).filesListFolderContinue({
						cursor: cursor
					});

					// Update cursor for next long poll
					cursor = changesResponse.result.cursor;

					// Check if our file was changed
					const ourFileChanged = changesResponse.result.entries.some(
						(entry: any) =>
							entry.path_lower === dropboxPath.toLowerCase() && entry['.tag'] !== 'deleted'
					);

					if (ourFileChanged) {
						await loadFromDropbox();
					}
				}

				// Small delay before next long poll to prevent tight loops
				await new Promise((resolve) => setTimeout(resolve, 100));
			} catch (error: any) {
				if (error.name === 'AbortError') {
					// Request was aborted, this is normal
					break;
				}

				console.error('Long polling error:', error);

				// On error, wait a bit before retrying
				await new Promise((resolve) => setTimeout(resolve, 5000));

				// Try to reinitialize cursor
				try {
					const folderResponse = await (dbx as any).filesListFolder({
						path: '',
						recursive: false,
						include_deleted: false
					});
					cursor = folderResponse.result.cursor;
				} catch (reinitError) {
					console.error('Failed to reinitialize cursor:', reinitError);
					break;
				}
			}
		}

		isLongPolling = false;
	}

	// Save content to Dropbox (debounced)
	async function saveToDropbox() {
		saveTimeout = null;
		if (!hasLoadedRemoteValue) return;
		if (!dbx) return;

		try {
			await (dbx as any).filesUpload({
				path: dropboxPath,
				contents: value,
				mode: 'overwrite',
				autorename: false
			});

			// Track what we just sent to Dropbox
			lastSentToDropbox = value;

			lastSyncTime = new Date();
			syncStatus = `Saved to Dropbox (${lastSyncTime.toLocaleTimeString()})`;

			// Update cursor after successful save
			try {
				const folderResponse = await (dbx as any).filesListFolder({
					path: '',
					recursive: false,
					include_deleted: false
				});
				cursor = folderResponse.result.cursor;
			} catch (error) {
				console.warn('Failed to update cursor after save:', error);
			}

			// Restart long polling if it's not running
			if (!isLongPolling) {
				startLongPolling();
			}
		} catch (error) {
			console.error('Failed to save to Dropbox:', error);
			syncStatus = 'Sync error (save)';
		}
	}

	// Handle clicking on sync status when not connected
	function handleSyncStatusClick() {
		if (!dbx && syncStatus.includes('developers/apps')) {
			window.open('https://www.dropbox.com/developers/apps/', '_blank');
		}
	}

	// Handle access token input
	function handleTokenInput(event: any) {
		accessToken = event.target.value;
		connectToDropbox();
	}

	// Debounced save to localStorage and Dropbox
	function debouncedSave() {
		if (value === lastValue) return;
		lastValue = value;

		// Clear existing timeout
		if (saveTimeout) {
			clearTimeout(saveTimeout);
		}

		// Set new timeout for 750ms before saving
		saveTimeout = setTimeout(async () => {
			if (dbx) {
				await saveToDropbox();
			}
		}, 750);
	}

	// Handle textarea input to track user activity
	function handleTextareaInput(event: any) {
		trackUserActivity();
		value = event.target.value;
	}

	// Save to localStorage whenever value changes
	$effect(() => {
		if (isLoaded) {
			if (lastValue === value) return;
			try {
				localStorage.setItem(fullStorageKey, value);
			} catch (error) {
				console.warn('Failed to save to localStorage:', error);
			}

			// Trigger debounced save to Dropbox
			if (dbx) {
				debouncedSave();
			}
		}
	});
</script>

<!-- svelte-ignore a11y_click_events_have_key_events -->
<!-- svelte-ignore a11y_no_static_element_interactions -->
<div class="dropbox-textarea-container">
	<textarea bind:value {placeholder} class={className} oninput={handleTextareaInput} {...restProps}
	></textarea>

	{#if showDropboxControls}
		<div class="dropbox-controls">
			<div class="token-row">
				<input
					type="text"
					bind:value={accessToken}
					oninput={handleTokenInput}
					placeholder="Paste Dropbox access token to enable sync..."
					class="token-input"
				/>
			</div>
		</div>
	{/if}

	<div
		class="sync-status"
		class:connected={dbx}
		class:error={syncStatus.includes('error')}
		class:debouncing={isDebouncing}
		class:typing={isUserTyping}
		class:longpolling={isLongPolling}
		class:clickable={!dbx && syncStatus.includes('developers/apps')}
		onclick={handleSyncStatusClick}
	>
		{#if isDebouncing}
			Saving in 1s... | {syncStatus}
		{:else if isUserTyping}
			Typing... | {syncStatus}
		{:else}
			{syncStatus} {isLongPolling ? '(watching for changes)' : ''}
		{/if}
	</div>
</div>

<style>
	.dropbox-textarea-container {
		display: flex;
		flex-direction: column;
		height: 100%;
	}

	textarea {
		flex: 1;
		width: 100%;
		background: transparent;
		color: #e0e0e0;
		border: none;
		font-family: 'Courier New', monospace;
		font-size: 14px;
		resize: none;
		outline: none;
		margin-bottom: 8px;
	}

	.dropbox-controls {
		display: flex;
		flex-direction: column;
		gap: 4px;
		margin-bottom: 4px;
	}

	.token-row {
		display: flex;
		gap: 8px;
		align-items: center;
	}

	.token-input {
		flex: 1;
		padding: 4px 8px;
		background: rgba(255, 255, 255, 0.1);
		color: #e0e0e0;
		border: 1px solid rgba(255, 255, 255, 0.2);
		border-radius: 4px;
		font-family: monospace;
		font-size: 12px;
	}

	.token-input:focus {
		outline: none;
		border-color: rgba(255, 255, 255, 0.4);
	}

	.connect-btn {
		padding: 4px 12px;
		background: rgba(74, 222, 128, 0.2);
		color: #4ade80;
		border: 1px solid #4ade80;
		border-radius: 4px;
		font-size: 12px;
		cursor: pointer;
		font-family: monospace;
	}

	.connect-btn:hover:not(:disabled) {
		background: rgba(74, 222, 128, 0.3);
	}

	.connect-btn:disabled {
		opacity: 0.5;
		cursor: not-allowed;
	}

	.connected-controls {
		margin-bottom: 4px;
	}

	.show-controls-btn {
		padding: 2px 8px;
		background: rgba(255, 255, 255, 0.1);
		color: #888;
		border: 1px solid rgba(255, 255, 255, 0.2);
		border-radius: 4px;
		font-size: 10px;
		cursor: pointer;
		font-family: monospace;
	}

	.show-controls-btn:hover {
		background: rgba(255, 255, 255, 0.15);
		color: #aaa;
	}

	.sync-status {
		font-size: 11px;
		color: #888;
		font-family: monospace;
		padding: 2px 0;
	}

	.sync-status.connected {
		color: #4ade80;
	}

	.sync-status.error {
		color: #ef4444;
	}

	.sync-status.debouncing {
		color: #fbbf24;
	}

	.sync-status.typing {
		color: #60a5fa;
	}

	.sync-status.longpolling {
		color: #a78bfa;
	}

	.sync-status.clickable {
		cursor: pointer;
		text-decoration: underline;
	}

	.sync-status.clickable:hover {
		color: #60a5fa;
	}
</style>
