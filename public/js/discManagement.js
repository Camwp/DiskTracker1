document.getElementById('addDiscBtn').addEventListener('click', () => {
    window.location.href = '/add-disc'; // Assuming you have a route to add a single disc
});

document.getElementById('bulkAddDiscBtn').addEventListener('click', () => {
    window.location.href = '/bulk-add-discs'; // Assuming you have a route to add discs in bulk
});

document.querySelectorAll('.row').forEach(row => {
    row.addEventListener('click', function () {
        const discId = this.getAttribute('data-disc-id');
        window.location.href = `/disc-details/${discId}`; // Route to view details for each disc
    });
});

document.getElementById('applyFilters').addEventListener('click', () => {
    const name = document.getElementById('filterName').value;
    const plastic = document.getElementById('filterPlastic').value;
    const type = document.getElementById('filterType').value;
    const color = document.getElementById('filterColor').value;

    const query = new URLSearchParams();

    if (name.trim()) query.append('name', name.trim());
    if (plastic.trim()) query.append('plastic', plastic.trim());
    if (type) query.append('type', type);
    if (color && color !== "#ffffff") query.append('color', color);  // Assuming "#ffffff" is the default for "All Colors"

    window.location.href = `/disc-management?${query.toString()}`;
});

document.getElementById('removeFilters').addEventListener('click', () => {
    window.location.href = '/disc-management'; // Redirects to the page without any query parameters
});

document.getElementById('toggleFilters').addEventListener('click', function () {
    const filterSection = document.getElementById('filterSection');
    if (filterSection.style.display === 'none') {
        filterSection.style.display = 'block';
        this.textContent = 'Hide Filters';
    } else {
        filterSection.style.display = 'none';
        this.textContent = 'Show Filters';
    }
});

document.getElementById('removeFilters').addEventListener('click', function () {
    document.getElementById('filterName').value = '';
    document.getElementById('filterPlastic').value = '';
    document.getElementById('filterType').value = '';
    document.getElementById('filterColor').value = '';
    // Optionally, you can reload the page to reset the filters
    window.location.href = '/disc-management';
});


document.querySelectorAll('.checkout-btn').forEach(button => {
    button.addEventListener('click', function (e) {
        e.stopPropagation();
        console.log("Current button text:", this.textContent); // Check current text
        const discId = this.getAttribute('data-disc-id');
        fetch(`/toggle-checkout/${discId}`, {
            method: 'POST'
        })
            .then(response => response.json())
            .then(data => {
                if (data.success) {
                    this.textContent = this.textContent.trim() === 'Check Out' ? 'Check In' : 'Check Out';
                } else {
                    alert('Failed to update disc status.');
                }
            })
            .catch(error => {
                console.error('Error updating disc status:', error);
                alert('Error updating disc status.');
            });
    });
});

document.querySelectorAll('.row').forEach(row => {
    row.addEventListener('click', function () {
        const discId = this.getAttribute('data-disc-id');
        window.location.href = `/disc-details/${discId}`; // Route to view details for each disc
    });
});
document.addEventListener('DOMContentLoaded', function () {
    // Loop through each row
    document.querySelectorAll('.row').forEach(row => {
        // Add click event listener to navigate to disc details
        row.addEventListener('click', function () {
            const discId = this.getAttribute('data-disc-id');
            window.location.href = `/disc-details/${discId}`; // Route to view details for each disc
        });

        // Prevent propagation of click events on select elements within the row
        row.querySelectorAll('select').forEach(select => {
            select.addEventListener('click', function (event) {
                event.stopPropagation();
            });
        });
    });

    // Trigger a click event for each select to update add-to-bag / remove-to-bag options
    document.querySelectorAll('select').forEach(select => {
        select.click(); // Trigger click event
    });
});

document.querySelectorAll('.addToBagBtn').forEach(button => {
    button.addEventListener('click', function (event) {
        event.stopPropagation(); // Prevent propagation of the click event to parent elements
        addToBag(event); // Call the addToBag function
    });
});

// Add event listener to update button text when a bag option is selected
document.querySelectorAll('.bag-option').forEach(option => {
    option.addEventListener('change', function (event) {
        updateButtonText(event.target.parentElement.parentElement);
    });
});

function updateButtonText(row) {
    const discId = row.getAttribute('data-disc-id');
    const selectedBagId = row.querySelector('.bag-option').value;
    const addToBagBtn = row.querySelector('.addToBagBtn');
    const removeFromBagBtn = row.querySelector('.removeFromBagBtn');

    // Check if the disc is in the selected bag
    fetch(`/check-disc-in-bag/${selectedBagId}/${discId}`)
        .then(response => response.json())
        .then(data => {
            if (data.inBag) {
                addToBagBtn.style.display = 'none'; // Hide "Add to Bag" button
                removeFromBagBtn.style.display = 'block'; // Show "Remove from Bag" button
            } else {
                addToBagBtn.style.display = 'block'; // Show "Add to Bag" button
                removeFromBagBtn.style.display = 'none'; // Hide "Remove from Bag" button
            }
        })
        .catch(error => {
            console.error('Error checking disc status in bag:', error);
        });
}
document.querySelectorAll('.removeFromBagBtn').forEach(button => {
    button.addEventListener('click', function (event) {
        event.stopPropagation(); // Prevent propagation of the click event to parent elements
        removeFromBag(event); // Call the removeFromBag function
    });
});

function removeFromBag(event) {
    event.preventDefault(); // Prevent default form submission behavior

    const selectedBagId = event.target.parentElement.querySelector('.bag-option').value;
    const discId = event.target.closest('.row').getAttribute('data-disc-id');

    // Perform the action to remove the disc from the selected bag
    fetch(`/new/remove-disc-from-bag/${selectedBagId}/${discId}`, {
        method: 'POST'
    })
        .then(response => response.text())
        .then(data => {
            // Assuming the server returns a success message
            alert(data);
            // Optionally, you can update the button text after successful removal
            //event.target.textContent = 'Add to Bag';
            location.reload();
        })
        .catch(error => {
            console.error('Error removing disc from bag:', error);
            alert('Error removing disc from bag.');
        });
}




function addToBag(event) {
    event.preventDefault(); // Prevent default form submission behavior

    const selectedBagId = event.target.parentElement.querySelector('.bag-option').value;
    const discId = event.target.closest('.row').getAttribute('data-disc-id');

    // Perform the action to add or remove the disc from the selected bag
    fetch(`/new/add-disc-to-bag/${selectedBagId}/${discId}`, {
        method: 'POST'
    })
        .then(response => response.json())
        .then(data => {
            if (data.success) {
                updateButtonText(event.target.parentElement); // Update button text after action
                alert('Disc action successful.');
            } else {
                alert('Failed to perform disc action.');
            }
        })
        .catch(error => {
            console.error('Error performing disc action:', error);
            alert('Error performing disc action.');
        });
}


function getSelectedDiscId() {
    // Implement this function to get the ID of the selected disc
    // For example, you can use data attributes or other methods to store the disc ID in the HTML
}


