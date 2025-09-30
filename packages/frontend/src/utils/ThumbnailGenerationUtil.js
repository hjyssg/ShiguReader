import Swal from 'sweetalert2';
import { toast } from 'react-toastify';
import React, { Component } from 'react';
import { pregenerateThumbnails } from '@api/thumbnail';



const askPregenerate = function (path, fastUpdateMode) {
    const requestPregenerate = async (mode) => {
        const reqBoby = {
            pregenerateThumbnailPath: path,
            fastUpdateMode: mode
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


    Swal.fire({
        title: "Generate Thumbnail",
        text: path,
        showDenyButton: true,
        showCancelButton: true,
        confirmButtonText: 'Full Update (Thumbnail And Metadata)',
        denyButtonText: 'Fast Update (Only For New File)',
        cancelButtonText: 'Cancel'
    }).then((result) => {
        if (result.isConfirmed) {
            requestPregenerate(false);
        } else if (result.isDenied) {
            requestPregenerate(true);
        }
    });
}

//https://stackoverflow.com/questions/47313645/module-exports-cannot-set-property-of-undefined
export { askPregenerate }
