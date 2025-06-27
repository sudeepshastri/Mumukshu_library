document.addEventListener('DOMContentLoaded', () => {
    // --- ELEMENT REFERENCES ---
    const libraryContainer = document.getElementById('library-container');
    const searchInput = document.getElementById('searchInput');
    const filtersContainer = document.getElementById('filters-container');
    const resetFiltersBtn = document.getElementById('resetFilters');
    const loadingIndicator = document.getElementById('loading');
    const modal = document.getElementById('itemModal');
    const modalBody = document.getElementById('modal-body');
    const closeModalBtn = document.querySelector('.close-button');

    // --- STATE MANAGEMENT ---
    let allItems = [];
    let currentFilters = {};

    // --- CSV PARSING ---
    // This regex handles commas inside quoted fields
    function parseCSV(text) {
        const rows = text.trim().split('\n');
        const headers = rows[0].split(',').map(h => h.trim());
        const data = rows.slice(1).map(row => {
            const values = row.split(/,(?=(?:(?:[^"]*"){2})*[^"]*$)/);
            if (values.length !== headers.length) return null;
            let obj = {};
            headers.forEach((header, i) => {
                obj[header] = values[i].replace(/"/g, '').trim();
            });
            return obj;
        }).filter(Boolean); // Filter out null/malformed rows
        return data;
    }

    // --- DATA FETCHING & INITIALIZATION ---
    async function loadLibrary() {
        try {
            const response = await fetch('library.csv');
            if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
            const csvData = await response.text();
            allItems = parseCSV(csvData);
            
            loadingIndicator.style.display = 'none';
            setupFilters();
            renderItems(allItems);
        } catch (error) {
            loadingIndicator.innerHTML = `<p>Error loading library. Please check the console and ensure 'library.csv' exists.</p>`;
            console.error("Failed to load or parse library.csv:", error);
        }
    }

    // --- DYNAMIC FILTER UI ---
    function setupFilters() {
        const filterableFields = ['category', 'type', 'author']; // Define which fields to create filters for
        
        filterableFields.forEach(field => {
            const uniqueValues = [...new Set(allItems.map(item => item[field]))].sort();
            const group = document.createElement('div');
            group.className = 'filter-group';
            group.innerHTML = `<h4>${field.charAt(0).toUpperCase() + field.slice(1)}</h4>`;
            
            uniqueValues.forEach(value => {
                const label = document.createElement('label');
                label.innerHTML = `<input type="checkbox" data-field="${field}" value="${value}"> ${value}`;
                group.appendChild(label);
            });
            filtersContainer.appendChild(group);
        });

        // Add event listener to the whole container
        filtersContainer.addEventListener('change', handleFilterChange);
    }
    
    // --- RENDERING & DISPLAY ---
    function renderItems(itemsToRender) {
        libraryContainer.innerHTML = '';
        if (itemsToRender.length === 0) {
            libraryContainer.innerHTML = '<p>No items match your criteria.</p>';
            return;
        }
        
        itemsToRender.forEach(item => {
            const card = document.createElement('div');
            card.className = 'card';
            // Use data- attributes for lazy loading and easy ID retrieval
            card.innerHTML = `
                <img class="card-thumbnail" data-src="${item.thumbnail_url || 'placeholder.jpg'}" alt="${item.title}">
                <div class="card-content">
                    <h3 class="card-title">${item.title}</h3>
                    <p class="card-author">${item.author}</p>
                </div>
            `;
            card.addEventListener('click', () => showModal(item));
            libraryContainer.appendChild(card);
        });

        lazyLoadImages();
    }
    
    // --- EVENT HANDLERS & LOGIC ---
    function handleFilterChange(e) {
        if (e.target.type === 'checkbox') {
            const field = e.target.dataset.field;
            const value = e.target.value;
            
            if (!currentFilters[field]) {
                currentFilters[field] = new Set();
            }
            
            if (e.target.checked) {
                currentFilters[field].add(value);
            } else {
                currentFilters[field].delete(value);
                if (currentFilters[field].size === 0) {
                    delete currentFilters[field];
                }
            }
            applyAllFilters();
        }
    }
    
    searchInput.addEventListener('input', () => applyAllFilters());

    resetFiltersBtn.addEventListener('click', () => {
        currentFilters = {};
        searchInput.value = '';
        document.querySelectorAll('#filters-container input[type="checkbox"]').forEach(cb => cb.checked = false);
        renderItems(allItems);
    });

    function applyAllFilters() {
        const searchTerm = searchInput.value.toLowerCase();

        let filteredItems = allItems.filter(item => {
            // Search logic
            const matchesSearch = searchTerm === '' ||
                item.title.toLowerCase().includes(searchTerm) ||
                item.author.toLowerCase().includes(searchTerm) ||
                item.tags.toLowerCase().includes(searchTerm);

            // Faceted filter logic
            const matchesFilters = Object.entries(currentFilters).every(([field, values]) => {
                return values.size === 0 || values.has(item[field]);
            });

            return matchesSearch && matchesFilters;
        });
        
        renderItems(filteredItems);
    }
    
    // --- MODAL ---
    function showModal(item) {
        modalBody.innerHTML = `
            <img src="${item.thumbnail_url}" alt="${item.title}" class="modal-img">
            <div class="modal-details">
                <h2 class="modal-title">${item.title}</h2>
                <h3 class="modal-author">By ${item.author} (${item.year})</h3>
                <div class="modal-tags">${item.tags.split(',').map(tag => `<span>${tag.trim()}</span>`).join('')}</div>
                <p class="modal-description">${item.description}</p>
                <div class="modal-buttons">
                    <a href="${item.download_url}" target="_blank" class="action-button download-btn">Download / View File</a>
                    <a href="https://archive.org/details/${item.id}" target="_blank" class="action-button archive-btn">View on Archive.org</a>
                </div>
            </div>
        `;
        modal.style.display = 'flex';
    }

    closeModalBtn.onclick = () => modal.style.display = 'none';
    window.onclick = (event) => {
        if (event.target == modal) {
            modal.style.display = "none";
        }
    };

    // --- PERFORMANCE (LAZY LOADING) ---
    function lazyLoadImages() {
        const lazyImages = document.querySelectorAll('img[data-src]');
        const observer = new IntersectionObserver((entries, observer) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    const img = entry.target;
                    img.src = img.dataset.src;
                    img.removeAttribute('data-src');
                    observer.unobserve(img);
                }
            });
        });
        lazyImages.forEach(img => observer.observe(img));
    }
    
    // --- KICK IT OFF ---
    loadLibrary();
});