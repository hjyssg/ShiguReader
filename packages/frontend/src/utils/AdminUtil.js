import Swal from 'sweetalert2';
import { toast } from 'react-toastify';
import React, { Component } from 'react';
import { pregenerateThumbnails } from '@api/thumbnail';



const askPregenerate = function (path, fastUpdateMode) {
    Swal.fire({
        title: "Pregenerate Thumbnail",
        text: path,
        showCancelButton: true,
        confirmButtonText: 'Yes',
        cancelButtonText: 'No'
    }).then(async (result) => {
        if (result.value === true) {
            const reqBoby = {
                pregenerateThumbnailPath: path,
                fastUpdateMode: fastUpdateMode
            }
            const res = await pregenerateThumbnails(reqBoby);
            const reason = res.json && res.json.reason;
            const isFailed = res.isFailed()

            const toastConfig = {
                position: "top-right",
                autoClose: 5 * 1000,
                hideProgressBar: true,
                closeOnClick: true,
                pauseOnHover: true,
                draggable: true,
                progress: false
            };

            const badge = isFailed ? (<span className="badge badge-danger">Error</span>) :
                (<span className="badge badge-success">progressing...</span>)

            let divContent = (
                <div className="toast" role="alert" aria-live="assertive" aria-atomic="true">
                    <div className="toast-header">
                        {badge}
                    </div>

                    {isFailed && reason && (
                        <div className="toast-body">
                            <div className="fail-reason-text">{reason}</div>
                        </div>
                    )}
                </div>);

            toast(divContent, toastConfig)
        }
    });
}

//https://stackoverflow.com/questions/47313645/module-exports-cannot-set-property-of-undefined
export { askPregenerate }
