import Swal from 'sweetalert2';
import Sender from './Sender';

const askPregenerate = function(path){
    Swal.fire({
        title: "Pregenerate Thumbnail",
        text:  path,
        showCancelButton: true,
        confirmButtonText: 'Yes',
        cancelButtonText: 'No'
    }).then((result) => {
        if (result.value === true) {
            const reqBoby = {
                path: path
            }
            Sender.post('/api/pregenerateThumbnails', reqBoby, res =>{
                console.log(res)
            });
        } 
    });
}

//https://stackoverflow.com/questions/47313645/module-exports-cannot-set-property-of-undefined
export {askPregenerate}
