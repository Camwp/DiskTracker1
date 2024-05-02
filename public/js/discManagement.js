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
