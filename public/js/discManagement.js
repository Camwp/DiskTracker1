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


