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
    const stability = document.getElementById('filterStability').value;
    const speed = document.getElementById('filterSpeed').value;
    const glide = document.getElementById('filterGlide').value;
    const turn = document.getElementById('filterTurn').value;
    const fade = document.getElementById('filterFade').value;
    const weightMin = document.getElementById('filterWeightMin').value;
    const weightMax = document.getElementById('filterWeightMax').value;

    const query = new URLSearchParams();

    if (name.trim()) query.append('name', name.trim());
    if (plastic.trim()) query.append('plastic', plastic.trim());
    if (type) query.append('type', type);
    if (color) query.append('color', color);
    if (stability) query.append('stability', stability);
    if (speed) query.append('speed', speed);
    if (glide) query.append('glide', glide);
    if (turn) query.append('turn', turn);
    if (fade) query.append('fade', fade);
    if (weightMin) query.append('weightMin', weightMin);
    if (weightMax) query.append('weightMax', weightMax);

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
    document.getElementById('filterStability').value = '';
    document.getElementById('filterSpeed').value = '';
    document.getElementById('filterGlide').value = '';
    document.getElementById('filterTurn').value = '';
    document.getElementById('filterFade').value = '';
    document.getElementById('filterWeightMin').value = '';
    document.getElementById('filterWeightMax').value = '';
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
                    //alert('Failed to update disc status.');
                }
            })
            .catch(error => {
                console.error('Error updating disc status:', error);
                //alert('Error updating disc status.');
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
        showBagList(event); // Call the showBagList function with the event
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
            //alert(data);
            // Optionally, you can update the button text after successful removal
            //event.target.textContent = 'Add to Bag';
            location.reload();
        })
        .catch(error => {
            console.error('Error removing disc from bag:', error);
            // alert('Error removing disc from bag.');
        });
}




function addDiscToBag(event) {
    event.preventDefault(); // Prevent default form submission behavior

    const selectedBagId = event.target.parentElement.querySelector('.bag-option').value;
    const discId = event.target.closest('.row').dataset.discId; // Access the dataset to get the discId

    // Perform the action to add or remove the disc from the selected bag
    fetch(`/new/add-disc-to-bag/${selectedBagId}/${discId}`, {
        method: 'POST'
    })
        .then(response => response.json())
        .then(data => {
            if (data.success) {
                updateButtonText(event.target.parentElement); // Update button text after action
                //alert('Disc action successful.');
            } else {
                //alert('Failed to perform disc action.');
            }
        })
        .catch(error => {
            console.error('Error performing disc action:', error);
            //alert('Error performing disc action.');
        });
}



function getSelectedDiscId() {
    // Implement this function to get the ID of the selected disc
    // For example, you can use data attributes or other methods to store the disc ID in the HTML
}

function showBagList(event) {
    event.preventDefault(); // Prevent default form submission behavior

    // Get the discId from the button that triggers the modal
    const discId = event.target.getAttribute('data-disc-id');

    fetch('/get-bags')
        .then(response => {
            if (!response.ok) {
                throw new Error('Failed to fetch bags');
            }
            return response.json();
        })
        .then(bags => {
            // Create a modal to display the bags list
            const modal = `
                <div class="modal" id="bagsModal">
                    <div class="modal-dialog">
                        <div class="modal-content">
                            <div class="modal-header">
                                <h5 class="modal-title">Select Bag</h5>
                                <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
                            </div>
                            <div class="modal-body">
                                <div id="bags">
                                    ${bags.map(bag => `<button class="bag-option btn btn-primary" data-bs-dismiss="modal" data-bag-id="${bag.id}">${bag.name}</button>`).join('')}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            `;
            document.body.insertAdjacentHTML('beforeend', modal);

            // Initialize the modal using Bootstrap's JavaScript
            const bagsModal = new bootstrap.Modal(document.getElementById('bagsModal'));
            bagsModal.show();

            // Add event listeners to bag buttons to handle adding the disc to the selected bag
            document.querySelectorAll('.bag-option').forEach(button => {
                button.addEventListener('click', () => {
                    const bagId = button.getAttribute('data-bag-id');
                    addToBag(discId, bagId);
                });
            });
        })
        .catch(error => {
            console.error('Error fetching bags:', error);
            alert('Failed to fetch bags');
        });
}


function addToBag(dId, bagId) {

    const selectedBagId = bagId;
    const discId = dId;
    console.log(discId, dId);

    // Perform the action to add or remove the disc from the selected bag
    fetch(`/new/add-disc-to-bag/${selectedBagId}/${discId}`, {
        method: 'POST'
    })
        .then(response => response.json())
        .then(data => {
            if (data.success) {
                //alert('Disc action successful.');
            } else {
                //alert('Failed to perform disc action.');
            }
        })
        .catch(error => {
            console.error('Error performing disc action:', error);
            //alert('Error performing disc action.');
        });
}


