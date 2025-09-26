import Swal from 'sweetalert2';
import Sender from '@services/Sender';
import { toast } from 'react-toastify';
import React, { Component } from 'react';



const askPregenerate = function (path, fastUpdateMode) {
    Swal.fire({
        title: "Pregenerate Thumbnail",
        text: path,
        showCancelButton: true,
        confirmButtonText: 'Yes',
        cancelButtonText: 'No'
    }).then((result) => {
        if (result.value === true) {
            const reqBoby = {
                pregenerateThumbnailPath: path,
                fastUpdateMode: fastUpdateMode
            }
            Sender.post('/api/pregenerateThumbnails', reqBoby, res => {
                const reason = res.json.reason;
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
            });
        }
    });
}

//https://stackoverflow.com/questions/47313645/module-exports-cannot-set-property-of-undefined
export { askPregenerate }
