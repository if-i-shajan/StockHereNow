const LoadingSpinner = ({ message = "Loading..." }) => {
    return (
        <div className="flex flex-col items-center justify-center min-h-screen py-12">
            <div className="animate-spin rounded-full h-16 w-16 border-b-4 border-agriGreen"></div>
            <p className="mt-4 text-agriGreen font-nunito text-lg">{message}</p>
        </div>
    );
};

export default LoadingSpinner;
